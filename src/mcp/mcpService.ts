import { StudentRepository } from '../domain/student/StudentRepository';
import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentPerformanceRepository } from '../domain/grade/StudentPerformanceRepository';
import { GradeRepository } from '../domain/grade/GradeRepository';
import { GradeCalculationAppService } from '../application/GradeCalculationAppService';
import { StudentId } from '../domain/student/StudentId';
import { GradedPerformance } from '../domain/grade/GradedPerformance';
import { ParticipationPerformance } from '../domain/grade/ParticipationPerformance';
import { GradedAssessment } from '../domain/grade/GradedAssessment';

import { CourseRosterService } from '../application/CourseRosterService';
export interface ClassResult {
  id: string;
  name: string;
  schoolYear: string;
}

export interface StudentResult {
  id: string;
  firstName: string;
  lastName: string;
  additionalInfo: Record<string, string>;
}

export interface CourseResult {
  id: string;
  title: string;
  schoolClass: ClassResult;
  assessmentCategories: {
    id: string;
    title: string;
    gradingType: string;
    displayAsGrade: boolean;
    isHidden: boolean;
  }[];
  gradeCompositions: {
    categoryId: string;
    categoryTitle: string;
    weight: number;
    subWeightType: 'NONE' | 'CHRONOLOGICAL';
  }[];
}

export interface CategoryGradeResult {
  categoryId: string;
  categoryTitle: string;
  weight: number;
  mean: number;
  performanceCount: number;
  displayGrade: number;
}

export interface GradingDetailResult {
  student: StudentResult;
  courses: {
    courseId: string;
    courseTitle: string;
    calculatedGrade: number | null;
    manualGrade: number | null;
    categoryGrades: CategoryGradeResult[];
    performances: {
      id: string;
      date: string;
      assessmentTitle: string;
      categoryTitle: string;
      maxPoints: number | null;
      score: number | null;
      symbol: string | null;
      type: string;
    }[];
  }[];
}

export interface GradingFormulaResult {
  courseId: string;
  courseTitle: string;
  categories: {
    id: string;
    title: string;
    gradingType: string;
    displayAsGrade: boolean;
    weight: number;
    subWeightType: 'NONE' | 'CHRONOLOGICAL';
  }[];
  algorithm: string;
  thresholds: { min: number; grade: number; label: string }[];
}

export interface CourseSummaryEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  calculatedGrade: number | null;
  manualGrade: number | null;
  categoryGrades: CategoryGradeResult[];
}

export class McpService {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly classRepo: SchoolClassRepository,
    private readonly courseRepo: CourseRepository,
    private readonly perfRepo: StudentPerformanceRepository,
    private readonly gradeRepo: GradeRepository,
    private readonly calcService: GradeCalculationAppService,
    private readonly rosterService: CourseRosterService,
  ) {}

  async listClasses(): Promise<ClassResult[]> {
    const classes = await this.classRepo.findAll();
    return classes.map(c => ({
      id: c.id,
      name: c.name,
      schoolYear: c.schoolYear.toString(),
    }));
  }

  async listStudentsByClass(classId: string): Promise<StudentResult[]> {
    const students = await this.studentRepo.findAll(classId);
    return students.map(s => {
      const info: Record<string, string> = {};
      for (const entry of s.additionalInformation) {
        info[entry.key] = entry.value;
      }
      return {
        id: s.id.value,
        firstName: s.name.firstName,
        lastName: s.name.lastName,
        additionalInfo: info,
      };
    });
  }

  async listCoursesByClass(classId: string): Promise<CourseResult[]> {
    const all = await this.courseRepo.findAll();
    const filtered = all.filter(c => c.schoolClass.id === classId);
    return filtered.map(c => ({
      id: c.id,
      title: c.title,
      schoolClass: {
        id: c.schoolClass.id,
        name: c.schoolClass.name,
        schoolYear: c.schoolClass.schoolYear.toString(),
      },
      assessmentCategories: c.assessmentCategories.map(ac => ({
        id: ac.id,
        title: ac.title,
        gradingType: ac.gradingType === 'NUMERIC' ? 'NUMERIC' as const : 'TERTIARY' as const,
        displayAsGrade: ac.displayAsGrade,
        isHidden: ac.isHidden,
      })),
      gradeCompositions: c.gradeCompositions.map(gc => ({
        categoryId: gc.assessmentCategory.id,
        categoryTitle: gc.assessmentCategory.title,
        weight: gc.weight,
        subWeightType: gc.subWeightType,
      })),
    }));
  }

  async getStudentGradings(studentId: string, courseId?: string): Promise<GradingDetailResult | { error: string }> {
    const sidResult = StudentId.create(studentId);
    if (!sidResult.ok) return { error: 'Invalid student ID' };

    const student = await this.studentRepo.findById(sidResult.value);
    if (!student) return { error: 'Student not found' };

    const info: Record<string, string> = {};
    for (const entry of student.additionalInformation) {
      info[entry.key] = entry.value;
    }

    const allPerformances = await this.perfRepo.findPerformancesByStudent(sidResult.value);
    const coursesMap = new Map<string, GradingDetailResult['courses'][0]>();

    const courseIds = new Set(allPerformances.map(p => p.assessment.course.id));
    if (courseId) courseIds.add(courseId);

    for (const cId of courseIds) {
      if (courseId && cId !== courseId) continue;

      const course = await this.courseRepo.findById(cId);
      if (!course) continue;

      const coursePerformances = allPerformances.filter(p => p.assessment.course.id === cId);

      const performances = coursePerformances.map(p => ({
        id: p.id,
        date: '',
        assessmentTitle: p.assessment.title,
        categoryTitle: p.assessment.category.title,
        maxPoints: p instanceof GradedPerformance ? (p.assessment as GradedAssessment).maxPoints : null,
        score: p.score,
        symbol: p instanceof ParticipationPerformance ? String(p.symbol) : null,
        type: p.constructor.name,
      }));

      let calculatedGrade: number | null = null;
      let categoryGrades: CategoryGradeResult[] = [];
      if (coursePerformances.length > 0) {
        const calcResult = await this.calcService.calculate(cId, studentId);
        if (calcResult.ok) {
          calculatedGrade = calcResult.value.displayGrade;
          categoryGrades = calcResult.value.categoryGrades.map(cg => ({
            categoryId: cg.categoryId,
            categoryTitle: cg.categoryTitle,
            weight: cg.weight,
            mean: cg.mean,
            performanceCount: cg.performanceCount,
            displayGrade: cg.displayGrade,
          }));
        }
      }

      const manualGrade = await this.gradeRepo.findByCourseAndStudent(cId, sidResult.value);

      coursesMap.set(cId, {
        courseId: cId,
        courseTitle: course.title,
        calculatedGrade,
        manualGrade: manualGrade?.score ?? null,
        categoryGrades,
        performances,
      });
    }

    return {
      student: {
        id: student.id.value,
        firstName: student.name.firstName,
        lastName: student.name.lastName,
        additionalInfo: info,
      },
      courses: Array.from(coursesMap.values()),
    };
  }

  async getGradingFormula(courseId: string): Promise<GradingFormulaResult | { error: string }> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return { error: 'Course not found' };

    const categories = course.gradeCompositions.map(gc => ({
      id: gc.assessmentCategory.id,
      title: gc.assessmentCategory.title,
      gradingType: gc.assessmentCategory.gradingType === 'NUMERIC' ? 'NUMERIC' as const : 'TERTIARY' as const,
      displayAsGrade: gc.assessmentCategory.displayAsGrade,
      weight: gc.weight,
      subWeightType: gc.subWeightType,
    }));

    const thresholds = [
      { min: 0.875, grade: 1, label: 'Sehr gut' },
      { min: 0.75, grade: 2, label: 'Gut' },
      { min: 0.625, grade: 3, label: 'Befriedigend' },
      { min: 0.5, grade: 4, label: 'Genügend' },
      { min: 0, grade: 5, label: 'Nicht genügend' },
    ];

    const algorithm = categories.length === 0
      ? 'Keine Notenkomposition konfiguriert.'
      : 'Die Gesamtnote wird als gewichteter Durchschnitt aller Kategorien berechnet. '
        + 'Die Gewichtung jeder Kategorie ist in Prozent angegeben. '
        + 'Bei CHRONOLOGICAL-Subgewichtung werden neuere Leistungen stärker gewichtet. '
        + 'Kategorien mit displayAsGrade=true werden für die Anzeige in Noten (1-5) umgerechnet.';

    return {
      courseId: course.id,
      courseTitle: course.title,
      categories,
      algorithm,
      thresholds,
    };
  }

  async getCourseSummary(courseId: string): Promise<CourseSummaryEntry[] | { error: string }> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return { error: 'Course not found' };

    const students = await this.rosterService.rosterOfCourse(course);
    const entries: CourseSummaryEntry[] = [];

    for (const student of students) {
      const sid = student.id.value;
      let calculatedGrade: number | null = null;
      let categoryGrades: CategoryGradeResult[] = [];

      const calcResult = await this.calcService.calculate(courseId, sid);
      if (calcResult.ok) {
        calculatedGrade = calcResult.value.displayGrade;
        categoryGrades = calcResult.value.categoryGrades.map(cg => ({
          categoryId: cg.categoryId,
          categoryTitle: cg.categoryTitle,
          weight: cg.weight,
          mean: cg.mean,
          performanceCount: cg.performanceCount,
          displayGrade: cg.displayGrade,
        }));
      }

      const sidObj = StudentId.create(sid);
      let manualGrade: number | null = null;
      if (sidObj.ok) {
        const mg = await this.gradeRepo.findByCourseAndStudent(courseId, sidObj.value);
        if (mg) manualGrade = mg.score;
      }

      entries.push({
        studentId: student.id.value,
        firstName: student.name.firstName,
        lastName: student.name.lastName,
        calculatedGrade,
        manualGrade,
        categoryGrades,
      });
    }

    return entries;
  }
}
