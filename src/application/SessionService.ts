import { SessionRepository } from '../domain/grade/SessionRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { StudentId } from '../domain/student/StudentId';
import { Session } from '../domain/grade/Session';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface SessionDto {
  id: string;
  date: string;
  notes: string;
  courseId: string;
  studentIds: string[];
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

export class SessionService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly courseRepo: CourseRepository,
    private readonly studentRepo: StudentRepository,
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
  };
}
