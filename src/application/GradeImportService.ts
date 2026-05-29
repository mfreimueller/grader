import { SessionRepository } from '../domain/grade/SessionRepository';
import { AssessmentRepository } from '../domain/grade/AssessmentRepository';
import { StudentPerformanceRepository } from '../domain/grade/StudentPerformanceRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { Session } from '../domain/grade/Session';
import { Assessment } from '../domain/grade/Assessment';
import { GradedAssessment } from '../domain/grade/GradedAssessment';
import { GradedPerformance } from '../domain/grade/GradedPerformance';
import { ParticipationPerformance } from '../domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { generateId } from '../domain/shared/IdGenerator';
import { GradeImportResultDto } from '../shared/types';

const SYMBOL_MAP: Record<string, string> = {
  '+': 'PLUS',
  '~': 'WELLE',
  '-': 'MINUS',
};

interface CsvRow {
  lastname: string;
  firstname: string;
  type: string;
  name: string;
  date: string;
  max: string;
  note: string;
}

export class GradeImportService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly perfRepo: StudentPerformanceRepository,
    private readonly studentRepo: StudentRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  async importCsv(courseId: string, csvContent: string): Promise<GradeImportResultDto> {
    const result: GradeImportResultDto = {
      sessionsCreated: 0,
      assessmentsCreated: 0,
      performancesCreated: 0,
      performancesUpdated: 0,
      warnings: [],
    };

    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      result.warnings.push(`Course with id "${courseId}" not found`);
      return result;
    }

    const rows = this.parseCsv(csvContent);

    for (const [index, row] of rows.entries()) {
      try {
        await this.processRow(row, course, result);
      } catch (e) {
        result.warnings.push(
          `Zeile ${index + 2}: ${(e as Error).message}`,
        );
      }
    }

    return result;
  }

  private parseCsv(content: string): CsvRow[] {
    const cleaned = content.replace(/^\uFEFF/, '').replace(/\r/g, '');
    const lines = cleaned.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) continue;
      const parts = line.split(';');
      if (parts.length < 7) {
        throw new Error(`Ungültiges Format, erwarte 7 semikolon-getrennte Spalten`);
      }
      rows.push({
        lastname: parts[0]!.trim(),
        firstname: parts[1]!.trim(),
        type: parts[2]!.trim(),
        name: parts[3]!.trim(),
        date: parts[4]!.trim(),
        max: parts[5]!.trim(),
        note: parts[6]!.trim(),
      });
    }
    return rows;
  }

  private async processRow(
    row: CsvRow,
    course: import('../domain/grade/Course').Course,
    result: GradeImportResultDto,
  ): Promise<void> {
    const students = await this.studentRepo.findByName(row.firstname, row.lastname);
    if (students.length === 0) {
      result.warnings.push(`Schüler/in "${row.firstname} ${row.lastname}" nicht gefunden, überspringe`);
      return;
    }
    if (students.length > 1) {
      result.warnings.push(
        `Mehrere Schüler/innen mit Namen "${row.firstname} ${row.lastname}" gefunden, überspringe`,
      );
      return;
    }
    const student = students[0]!;

    const category = course.assessmentCategories.find(c => c.title === row.type);
    if (!category) {
      result.warnings.push(
        `Kategorie "${row.type}" im Kurs "${course.title}" nicht gefunden, überspringe`,
      );
      return;
    }

    const sessionDate = this.parseDate(row.date);

    const sessions = await this.sessionRepo.findByCourse(course.id);
    let session = sessions.find(s =>
      s.date.getFullYear() === sessionDate.getFullYear()
      && s.date.getMonth() === sessionDate.getMonth()
      && s.date.getDate() === sessionDate.getDate(),
    );
    if (!session) {
      session = Session.create(generateId(), sessionDate, '', course);
      await this.sessionRepo.save(session);
      result.sessionsCreated++;
    }

    const sessionAssessments = await this.assessmentRepo.findBySession(session.id);
    let assessment = sessionAssessments.find(a => a.title === row.name);
    if (!assessment) {
      const hasMax = row.max.length > 0;
      const assessmentId = generateId();

      if (hasMax) {
        const maxPoints = this.parseDecimal(row.max);
        const created = GradedAssessment.create(
          assessmentId, row.name, sessionDate, category, course, maxPoints, false,
        );
        if (!created.ok) {
          result.warnings.push(
            `${row.name}: ${created.error.message}`,
          );
          return;
        }
        assessment = created.value;
      } else {
        assessment = new Assessment(assessmentId, row.name, sessionDate, category, course, false);
      }

      const loaded = await this.sessionRepo.findById(session.id);
      if (!loaded) {
        result.warnings.push(`Sitzung "${row.date}" nicht gefunden nach Anlegen`);
        return;
      }
      const reconstituted = Session.reconstitute(
        loaded.id, loaded.date, loaded.notes, loaded.course,
        [...loaded.students], [...loaded.assessments, assessment],
      );
      await this.sessionRepo.save(reconstituted);
      result.assessmentsCreated++;
    }

    const existingPerformances = await this.perfRepo.findPerformancesByAssessment(assessment.id);
    const existing = existingPerformances.find(p => p.student.id.value === student.id.value);
    const perfId = existing?.id ?? generateId();
    const perfDate = sessionDate;

    if (assessment instanceof GradedAssessment) {
      const scoreValue = row.note.length > 0 ? this.parseDecimal(row.note) : null;
      if (scoreValue === null) {
        const created = GradedPerformance.create(perfId, perfDate, student, assessment, 0);
        if (!created.ok) {
          result.warnings.push(`${row.name}: ${created.error.message}`);
          return;
        }
        await this.perfRepo.savePerformance(created.value);
      } else {
        const created = GradedPerformance.create(perfId, perfDate, student, assessment, scoreValue);
        if (!created.ok) {
          result.warnings.push(`${row.name}: ${created.error.message}`);
          return;
        }
        await this.perfRepo.savePerformance(created.value);
      }
    } else {
      const symbolRaw = row.note.length > 0 ? (SYMBOL_MAP[row.note] ?? 'WELLE') : 'WELLE';
      const symbolResult = ParticipationSymbol.create(symbolRaw);
      if (!symbolResult.ok) {
        result.warnings.push(`${row.name}: ${symbolResult.error.message}`);
        return;
      }
      const created = ParticipationPerformance.create(
        perfId, perfDate, student, assessment, symbolResult.value,
      );
      if (!created.ok) {
        result.warnings.push(`${row.name}: ${created.error.message}`);
        return;
      }
      await this.perfRepo.savePerformance(created.value);
    }

    if (existing) {
      result.performancesUpdated++;
    } else {
      result.performancesCreated++;
    }
  }

  private parseDate(raw: string): Date {
    const parts = raw.split('.');
    if (parts.length !== 3) {
      throw new Error(`Ungültiges Datum: "${raw}"`);
    }
    const dd = parseInt(parts[0]!, 10);
    const mm = parseInt(parts[1]!, 10) - 1;
    let yy = parseInt(parts[2]!, 10);
    if (yy < 100) yy += 2000;
    return new Date(yy, mm, dd);
  }

  private parseDecimal(raw: string): number {
    const normalized = raw.replace(',', '.');
    return parseFloat(normalized);
  }
}
