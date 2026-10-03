import { CourseRepository } from '../domain/grade/CourseRepository';
import { CourseRosterService } from './CourseRosterService';
import { StudentPickCountRepository } from '../domain/grade/StudentPickCountRepository';
import { Student } from '../domain/student/Student';
import { StudentPicker } from '../domain/grade/StudentPicker';
import { PickCount } from '../domain/grade/PickCount';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';

export interface StudentPickDto {
  studentId: string;
  firstName: string;
  lastName: string;
  pickCount: number;
  color: string | null;
}

export interface RosterEntryDto extends StudentPickDto {
  /** Whether a fair-mode pick could currently draw this student. */
  inFairPool: boolean;
}

/** Schülerauswahl: picks students of a course for oral participation and keeps count of the picks. */
export class StudentPickerService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly rosterService: CourseRosterService,
    private readonly pickRepo: StudentPickCountRepository,
    private readonly random: () => number = Math.random,
  ) {}

  async list(courseId: string): Promise<Result<RosterEntryDto[]>> {
    const roster = await this.loadRoster(courseId);
    if (!roster.ok) return Result.fail(roster.error);
    const counts = await this.pickRepo.findByCourse(courseId);
    const fairPool = new Set(StudentPicker.fairPool(roster.value.map((s) => s.id.value), counts));
    return Result.ok(
      roster.value.map((s) => ({
        ...toDto(s, counts.get(s.id.value) ?? 0),
        inFairPool: fairPool.has(s.id.value),
      })),
    );
  }

  async pickRandom(courseId: string, fair: boolean): Promise<Result<StudentPickDto>> {
    const roster = await this.loadRoster(courseId);
    if (!roster.ok) return Result.fail(roster.error);
    const counts = await this.pickRepo.findByCourse(courseId);

    const winnerId = StudentPicker.pickRandom(
      roster.value.map((s) => s.id.value),
      counts,
      fair,
      this.random,
    );
    if (!winnerId.ok) return Result.fail(winnerId.error);
    return this.pick(courseId, roster.value, winnerId.value);
  }

  async pickStudent(courseId: string, studentId: string): Promise<Result<StudentPickDto>> {
    const roster = await this.loadRoster(courseId);
    if (!roster.ok) return Result.fail(roster.error);
    return this.pick(courseId, roster.value, studentId);
  }

  async setPickCount(courseId: string, studentId: string, count: number): Promise<Result<StudentPickDto>> {
    const pickCount = PickCount.create(count);
    if (!pickCount.ok) return Result.fail(pickCount.error);
    const roster = await this.loadRoster(courseId);
    if (!roster.ok) return Result.fail(roster.error);
    const student = roster.value.find((s) => s.id.value === studentId);
    if (!student) return Result.fail(new NotFoundError('Student', studentId));

    await this.pickRepo.setCount(courseId, studentId, pickCount.value.value);
    return Result.ok(toDto(student, pickCount.value.value));
  }

  async reset(courseId: string): Promise<Result<void>> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));
    await this.pickRepo.reset(courseId);
    return Result.ok(undefined as void);
  }

  private async pick(courseId: string, roster: Student[], studentId: string): Promise<Result<StudentPickDto>> {
    const student = roster.find((s) => s.id.value === studentId);
    if (!student) return Result.fail(new NotFoundError('Student', studentId));
    const newCount = await this.pickRepo.increment(courseId, studentId);
    return Result.ok(toDto(student, newCount));
  }

  /** The students taught in the course, sorted by name. */
  private loadRoster(courseId: string): Promise<Result<Student[]>> {
    return this.rosterService.rosterOf(courseId);
  }
}

function toDto(student: Student, pickCount: number): StudentPickDto {
  return {
    studentId: student.id.value,
    firstName: student.name.firstName,
    lastName: student.name.lastName,
    pickCount,
    color: student.color?.value ?? null,
  };
}
