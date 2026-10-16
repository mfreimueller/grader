import { SessionRepository } from '../domain/grade/SessionRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { StudentId } from '../domain/student/StudentId';
import { Session } from '../domain/grade/Session';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import { CourseRosterService } from './CourseRosterService';
import { isCalendarDay } from './calendarDay';
import { generateId } from '../domain/shared/IdGenerator';

export interface SessionDto {
  id: string;
  date: string;
  notes: string;
  courseId: string;
  studentIds: string[];
  absentStudentIds: string[];
  studentNotes: { studentId: string; text: string }[];
}

export interface CreateSessionInput {
  courseId: string;
  date: string;
  notes?: string;
  studentIds?: string[];
}

export interface UpdateSessionInput {
  date?: string;
  notes?: string;
}

export const STUDENT_NOTE_MAX_LENGTH = 2000;

export class SessionService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly courseRepo: CourseRepository,
    private readonly studentRepo: StudentRepository,
    private readonly rosterService: CourseRosterService,
  ) {}

  async listByCourse(courseId: string): Promise<SessionDto[]> {
    const sessions = await this.sessionRepo.findByCourse(courseId);
    return sessions.map(toDto);
  }

  async create(input: CreateSessionInput): Promise<Result<SessionDto>> {
    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));

    const session = Session.create(generateId(), new Date(input.date), input.notes ?? '', course);

    if (input.studentIds) {
      for (const sid of input.studentIds) {
        const idResult = StudentId.create(sid);
        if (!idResult.ok) return Result.fail(idResult.error);
        const student = await this.studentRepo.findById(idResult.value);
        if (student) {
          session.addStudent(student);
        }
      }
    }

    await this.sessionRepo.save(session);
    return Result.ok(toDto(session));
  }

  /**
   * The session of the course on a calendar day (`YYYY-MM-DD`), or null. Sessions are stored as midnight
   * UTC of their day, like the session form does. Several sessions on one day are possible; the one with
   * the smallest id wins so repeated calls agree.
   */
  async findOnDate(courseId: string, date: string): Promise<SessionDto | null> {
    const sessions = await this.sessionRepo.findByCourse(courseId);
    const [first] = sessions
      .filter((s) => s.date.toISOString().slice(0, 10) === date)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    return first ? toDto(first) : null;
  }

  /** Like {@link findOnDate}, but creates an empty session when the course has none on that day. */
  async findOrCreateOnDate(courseId: string, date: string): Promise<Result<SessionDto>> {
    if (!isCalendarDay(date)) {
      return Result.fail(new ValidationError(`Date must be a calendar day as YYYY-MM-DD, got "${date}"`));
    }

    const existing = await this.findOnDate(courseId, date);
    if (existing) return Result.ok(existing);

    return this.create({ courseId, date });
  }

  async update(id: string, input: UpdateSessionInput): Promise<Result<SessionDto>> {
    const existing = await this.sessionRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('Session', id));

    if (input.date !== undefined) {
      existing.updateDate(new Date(input.date));
    }
    if (input.notes !== undefined) {
      existing.updateNotes(input.notes);
    }

    await this.sessionRepo.save(existing);
    return Result.ok(toDto(existing));
  }

  /** Marks a student absent or present for one session. Only students taught in the course can be marked absent. */
  async setAbsence(sessionId: string, studentId: string, absent: boolean): Promise<Result<SessionDto>> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return Result.fail(new NotFoundError('Session', sessionId));

    const idResult = StudentId.create(studentId);
    if (!idResult.ok) return Result.fail(idResult.error);

    if (absent) {
      const student = await this.studentRepo.findById(idResult.value);
      if (!student) return Result.fail(new NotFoundError('Student', studentId));
      const roster = await this.rosterService.rosterOfCourse(session.course);
      if (!roster.some(s => s.id.equals(idResult.value))) {
        return Result.fail(new ValidationError('Der Schüler gehört nicht zu diesem Kurs.'));
      }
      session.markAbsent(idResult.value);
    } else {
      session.markPresent(idResult.value);
    }

    await this.sessionRepo.save(session);
    return Result.ok(toDto(session));
  }

  /** Sets (or, for blank text, removes) the general note of a student for one session. */
  async setStudentNote(sessionId: string, studentId: string, text: string): Promise<Result<SessionDto>> {
    if (text.length > STUDENT_NOTE_MAX_LENGTH) {
      return Result.fail(new ValidationError(`Die Notiz darf höchstens ${STUDENT_NOTE_MAX_LENGTH} Zeichen lang sein.`));
    }
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return Result.fail(new NotFoundError('Session', sessionId));

    const idResult = StudentId.create(studentId);
    if (!idResult.ok) return Result.fail(idResult.error);
    const student = await this.studentRepo.findById(idResult.value);
    if (!student) return Result.fail(new NotFoundError('Student', studentId));
    const roster = await this.rosterService.rosterOfCourse(session.course);
    if (!roster.some(s => s.id.equals(idResult.value))) {
      return Result.fail(new ValidationError('Der Schüler gehört nicht zu diesem Kurs.'));
    }

    session.setStudentNote(idResult.value, text);
    await this.sessionRepo.save(session);
    return Result.ok(toDto(session));
  }

  async delete(id: string): Promise<Result<void>> {
    const existing = await this.sessionRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('Session', id));
    await this.sessionRepo.delete(id);
    return Result.ok(undefined as void);
  }
}

function toDto(s: Session): SessionDto {
  return {
    id: s.id,
    date: s.date.toISOString(),
    notes: s.notes,
    courseId: s.course.id,
    studentIds: s.students.map(st => st.id.value),
    absentStudentIds: [...s.absentStudentIds],
    studentNotes: [...s.studentNotes],
  };
}
