import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { SessionRepository } from '../domain/grade/SessionRepository';
import { StudentPerformanceRepository } from '../domain/grade/StudentPerformanceRepository';
import { FindingRepository } from '../domain/grade/FindingRepository';
import { GradeRepository } from '../domain/grade/GradeRepository';
import { StudentPickCountRepository } from '../domain/grade/StudentPickCountRepository';
import { CourseRosterRepository } from '../domain/grade/CourseRosterRepository';
import { UnitOfWork } from '../domain/shared/UnitOfWork';
import { generateId } from '../domain/shared/IdGenerator';
import { SchoolClass } from '../domain/student/SchoolClass';
import { SchoolYear } from '../domain/student/SchoolYear';
import { Student } from '../domain/student/Student';
import { StudentId } from '../domain/student/StudentId';
import { Name } from '../domain/student/Name';
import { Color } from '../domain/student/Color';
import { Course } from '../domain/grade/Course';
import { AssessmentCategory } from '../domain/grade/AssessmentCategory';
import { GradeComposition } from '../domain/grade/GradeComposition';
import { SubWeightType } from '../domain/grade/SubWeightType';
import { gradingTypeFromString } from '../domain/grade/GradingType';
import { Assessment } from '../domain/grade/Assessment';
import { GradedAssessment } from '../domain/grade/GradedAssessment';
import { Session } from '../domain/grade/Session';
import { StudentPerformance } from '../domain/grade/StudentPerformance';
import { GradedPerformance } from '../domain/grade/GradedPerformance';
import { ParticipationPerformance } from '../domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { Finding } from '../domain/grade/Finding';
import { Note } from '../domain/grade/Note';
import { RemoteDocument } from '../domain/grade/RemoteDocument';
import { Grade } from '../domain/grade/Grade';
import type {
  DigigradeAssessment,
  DigigradeCourse,
  DigigradeExport,
  DigigradePerformance,
  DigigradeSession,
} from './DigigradeExport';

export interface CreatedSkipped {
  created: number;
  skipped: number;
}

export interface DigigradeImportResult {
  classes: CreatedSkipped;
  students: CreatedSkipped;
  courses: CreatedSkipped;
  sessionsCreated: number;
  performancesCreated: number;
  warnings: string[];
}

/**
 * Merges a digigrade export into the local database: classes are matched by name and school year,
 * students by name within their class, courses by title within their class. Existing data is never
 * overwritten, and an existing course is skipped completely. Everything happens in one transaction.
 */
export class DigigradeImportService {
  constructor(
    private readonly classRepo: SchoolClassRepository,
    private readonly studentRepo: StudentRepository,
    private readonly courseRepo: CourseRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly perfRepo: StudentPerformanceRepository,
    private readonly findingRepo: FindingRepository,
    private readonly gradeRepo: GradeRepository,
    private readonly pickRepo: StudentPickCountRepository,
    private readonly rosterRepo: CourseRosterRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  import(doc: DigigradeExport): Promise<DigigradeImportResult> {
    return this.unitOfWork.run(() => this.mergeAll(doc));
  }

  private async mergeAll(doc: DigigradeExport): Promise<DigigradeImportResult> {
    const result: DigigradeImportResult = {
      classes: { created: 0, skipped: 0 },
      students: { created: 0, skipped: 0 },
      courses: { created: 0, skipped: 0 },
      sessionsCreated: 0,
      performancesCreated: 0,
      warnings: [],
    };

    const classes = await this.mergeClasses(doc, result);
    const students = await this.mergeStudents(doc, classes, result);
    for (const course of doc.courses) {
      await this.mergeCourse(course, classes, students, result);
    }
    return result;
  }

  private async mergeClasses(doc: DigigradeExport, result: DigigradeImportResult): Promise<Map<string, SchoolClass>> {
    const byExportId = new Map<string, SchoolClass>();
    for (const exported of doc.classes) {
      const year = SchoolYear.create(exported.schoolYear);
      if (!year.ok) {
        result.warnings.push(`Klasse ${exported.name}: ${year.error.message}`);
        continue;
      }
      const existing = await this.classRepo.findByNameAndYear(exported.name, year.value.toString());
      if (existing) {
        byExportId.set(exported.id, existing);
        result.classes.skipped++;
        continue;
      }
      const created = new SchoolClass(generateId(), exported.name, year.value);
      await this.classRepo.save(created);
      byExportId.set(exported.id, created);
      result.classes.created++;
    }
    return byExportId;
  }

  private async mergeStudents(
    doc: DigigradeExport,
    classes: Map<string, SchoolClass>,
    result: DigigradeImportResult,
  ): Promise<Map<string, Student>> {
    const byExportId = new Map<string, Student>();
    for (const exported of doc.students) {
      const label = `${exported.lastName} ${exported.firstName}`;
      const schoolClass = classes.get(exported.classId);
      if (!schoolClass) {
        result.warnings.push(`Schüler ${label} übersprungen: Klasse nicht vorhanden.`);
        continue;
      }
      const name = Name.create(exported.firstName, exported.lastName);
      if (!name.ok) {
        result.warnings.push(`Schüler ${label} übersprungen: ${name.error.message}`);
        continue;
      }

      const sameClass = await this.studentRepo.findAll(schoolClass.id);
      const existing = sameClass.find(
        (s) => s.name.firstName === name.value.firstName && s.name.lastName === name.value.lastName,
      );
      if (existing) {
        byExportId.set(exported.id, existing);
        result.students.skipped++;
        continue;
      }

      let color: Color | null = null;
      if (exported.color) {
        const parsed = Color.create(exported.color);
        if (parsed.ok) color = parsed.value;
        else result.warnings.push(`Schüler ${label}: Farbe ${exported.color} ignoriert.`);
      }
      const id = StudentId.create(generateId());
      if (!id.ok) throw id.error;
      const created = Student.create(id.value, name.value, schoolClass, null, color);
      await this.studentRepo.save(created);
      byExportId.set(exported.id, created);
      result.students.created++;
    }
    return byExportId;
  }

  private async mergeCourse(
    exported: DigigradeCourse,
    classes: Map<string, SchoolClass>,
    students: Map<string, Student>,
    result: DigigradeImportResult,
  ): Promise<void> {
    const schoolClass = classes.get(exported.classId);
    if (!schoolClass) {
      result.warnings.push(`Kurs ${exported.title} übersprungen: Klasse nicht vorhanden.`);
      result.courses.skipped++;
      return;
    }
    const existing = (await this.courseRepo.findAll()).find(
      (c) => c.title === exported.title && c.schoolClass.id === schoolClass.id,
    );
    if (existing) {
      result.courses.skipped++;
      return;
    }

    const categories = this.buildCategories(exported, result);
    const compositions = this.buildCompositions(exported, categories, result);
    const course = Course.reconstitute(
      generateId(),
      exported.title,
      schoolClass,
      [...categories.values()],
      compositions,
    );
    await this.courseRepo.save(course);
    result.courses.created++;

    const excluded = new Set(
      exported.excludedStudentIds.map((id) => students.get(id)?.id.value).filter((id): id is string => !!id),
    );
    await this.rosterRepo.replaceExcluded(course.id, [...excluded]);
    const roster = (await this.studentRepo.findAll(schoolClass.id)).filter((s) => !excluded.has(s.id.value));

    for (const session of exported.sessions) {
      await this.mergeSession(session, course, categories, roster, students, result);
    }
    await this.mergeGrades(exported, course, students, result);
    await this.mergePickCounts(exported, course, students, result);
  }

  private buildCategories(exported: DigigradeCourse, result: DigigradeImportResult): Map<string, AssessmentCategory> {
    const categories = new Map<string, AssessmentCategory>();
    for (const category of exported.categories) {
      const gradingType = gradingTypeFromString(category.gradingType);
      if (!gradingType.ok) {
        result.warnings.push(`Kategorie ${category.title} (${exported.title}) übersprungen: ${gradingType.error.message}`);
        continue;
      }
      categories.set(
        category.id,
        new AssessmentCategory(generateId(), category.title, gradingType.value, category.displayAsGrade, category.hidden),
      );
    }
    return categories;
  }

  private buildCompositions(
    exported: DigigradeCourse,
    categories: Map<string, AssessmentCategory>,
    result: DigigradeImportResult,
  ): GradeComposition[] {
    const compositions: GradeComposition[] = [];
    for (const composition of exported.compositions) {
      const category = categories.get(composition.categoryId);
      if (!category) continue;
      const weight = Math.round(composition.weight);
      const subWeight =
        composition.subWeightType === 'CHRONOLOGICAL' ? SubWeightType.CHRONOLOGICAL : SubWeightType.NONE;
      const created = GradeComposition.create(category, weight, subWeight);
      if (!created.ok) {
        result.warnings.push(
          `Gewichtung ${composition.weight} der Kategorie ${category.title} (${exported.title}) ist nach dem Runden ungültig und wurde übersprungen.`,
        );
        continue;
      }
      if (weight !== composition.weight) {
        result.warnings.push(
          `Gewichtung der Kategorie ${category.title} (${exported.title}) von ${composition.weight} auf ${weight} gerundet.`,
        );
      }
      compositions.push(created.value);
    }
    return compositions;
  }

  private async mergeSession(
    exported: DigigradeSession,
    course: Course,
    categories: Map<string, AssessmentCategory>,
    roster: Student[],
    students: Map<string, Student>,
    result: DigigradeImportResult,
  ): Promise<void> {
    const date = new Date(exported.date);
    if (Number.isNaN(date.getTime())) {
      result.warnings.push(`Sitzung ${exported.date} (${course.title}) übersprungen: ungültiges Datum.`);
      return;
    }

    const sessionId = generateId();
    const assessments: { exported: DigigradeAssessment; domain: Assessment }[] = [];
    for (const a of exported.assessments) {
      const category = categories.get(a.categoryId);
      if (!category) {
        result.warnings.push(`Beurteilung ${a.title} (${course.title}) übersprungen: Kategorie nicht vorhanden.`);
        continue;
      }
      if (a.maxPoints !== null) {
        const graded = GradedAssessment.create(generateId(), a.title, category, course, sessionId, a.maxPoints, a.impromptu);
        if (!graded.ok) {
          result.warnings.push(`Beurteilung ${a.title} (${course.title}) übersprungen: ${graded.error.message}`);
          continue;
        }
        assessments.push({ exported: a, domain: graded.value });
      } else {
        assessments.push({
          exported: a,
          domain: new Assessment(generateId(), a.title, category, course, sessionId, a.impromptu),
        });
      }
    }

    const session = Session.reconstitute(
      sessionId,
      date,
      exported.notes ?? '',
      course,
      roster,
      assessments.map((a) => a.domain),
    );
    await this.sessionRepo.save(session);
    result.sessionsCreated++;

    for (const { exported: a, domain } of assessments) {
      for (const p of a.performances) {
        await this.mergePerformance(p, domain, course, students, result);
      }
    }
  }

  private async mergePerformance(
    exported: DigigradePerformance,
    assessment: Assessment,
    course: Course,
    students: Map<string, Student>,
    result: DigigradeImportResult,
  ): Promise<void> {
    const student = students.get(exported.studentId);
    if (!student) {
      result.warnings.push(
        `Leistung in ${assessment.title} (${course.title}) übersprungen: Schüler ${exported.studentId} nicht vorhanden.`,
      );
      return;
    }

    let performance: StudentPerformance;
    if (assessment instanceof GradedAssessment) {
      const graded = GradedPerformance.create(generateId(), student, assessment, exported.score ?? 0);
      if (!graded.ok) {
        result.warnings.push(`Leistung in ${assessment.title} (${course.title}) übersprungen: ${graded.error.message}`);
        return;
      }
      performance = graded.value;
    } else {
      const symbol = ParticipationSymbol.create(exported.symbol ?? '');
      if (!symbol.ok) {
        result.warnings.push(`Leistung in ${assessment.title} (${course.title}) übersprungen: ${symbol.error.message}`);
        return;
      }
      const participation = ParticipationPerformance.create(generateId(), student, assessment, symbol.value);
      if (!participation.ok) throw participation.error;
      performance = participation.value;
    }

    await this.perfRepo.savePerformance(performance);
    result.performancesCreated++;

    for (const finding of exported.findings) {
      const domain = toFinding(finding);
      if (domain) await this.findingRepo.save(domain, performance.id);
    }
  }

  private async mergeGrades(
    exported: DigigradeCourse,
    course: Course,
    students: Map<string, Student>,
    result: DigigradeImportResult,
  ): Promise<void> {
    for (const g of exported.grades) {
      const student = students.get(g.studentId);
      if (!student) continue;
      const grade = Grade.create(generateId(), student, course, g.score);
      if (!grade.ok) {
        result.warnings.push(`Note für ${student.name.lastName} (${course.title}) übersprungen: ${grade.error.message}`);
        continue;
      }
      await this.gradeRepo.save(grade.value);
    }
  }

  private async mergePickCounts(
    exported: DigigradeCourse,
    course: Course,
    students: Map<string, Student>,
    result: DigigradeImportResult,
  ): Promise<void> {
    for (const pick of exported.pickCounts) {
      const student = students.get(pick.studentId);
      if (!student || !Number.isInteger(pick.pickCount) || pick.pickCount < 0) {
        result.warnings.push(`Aufrufzähler in ${course.title} für Schüler ${pick.studentId} übersprungen.`);
        continue;
      }
      await this.pickRepo.setCount(course.id, student.id.value, pick.pickCount);
    }
  }
}

function toFinding(finding: { type: string; text: string | null; url: string | null }): Finding | null {
  if (finding.type === 'NOTE' && finding.text) return new Note(generateId(), finding.text);
  if (finding.type === 'REMOTE_DOCUMENT' && finding.url) return new RemoteDocument(generateId(), finding.url);
  return null;
}
