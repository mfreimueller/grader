import { CourseRepository } from '../domain/grade/CourseRepository';
import { StudentRepository } from '../domain/student/StudentRepository';
import { CourseRosterRepository } from '../domain/grade/CourseRosterRepository';
import { CourseRoster } from '../domain/grade/CourseRoster';
import { Course } from '../domain/grade/Course';
import { Student } from '../domain/student/Student';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';

export interface CourseRosterEntryDto {
  studentId: string;
  firstName: string;
  lastName: string;
  color: string | null;
  included: boolean;
  /** Live performances and grades the student has in this course (kept when they are excluded). */
  entryCount: number;
}

/** Which students of a class are actually taught in a course. Single source of truth for every consumer. */
export class CourseRosterService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly studentRepo: StudentRepository,
    private readonly rosterRepo: CourseRosterRepository,
  ) {}

  async list(courseId: string): Promise<Result<CourseRosterEntryDto[]>> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));

    const excluded = await this.rosterRepo.findExcludedIds(courseId);
    const classStudents = CourseRoster.of(await this.studentRepo.findAll(course.schoolClass.id), new Set());
    const entries: CourseRosterEntryDto[] = [];
    for (const student of classStudents) {
      entries.push(await this.toDto(courseId, student, !excluded.has(student.id.value)));
    }
    return Result.ok(entries);
  }

  async setIncluded(courseId: string, studentId: string, included: boolean): Promise<Result<CourseRosterEntryDto>> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));

    const student = (await this.studentRepo.findAll(course.schoolClass.id)).find((s) => s.id.value === studentId);
    if (!student) return Result.fail(new NotFoundError('Student', studentId));

    await this.rosterRepo.setExcluded(courseId, studentId, !included);
    return Result.ok(await this.toDto(courseId, student, included));
  }

  async setAll(courseId: string, included: boolean): Promise<Result<void>> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));

    const classStudents = await this.studentRepo.findAll(course.schoolClass.id);
    await this.rosterRepo.replaceExcluded(courseId, included ? [] : classStudents.map((s) => s.id.value));
    return Result.ok(undefined as void);
  }

  /** The students taught in the course: live class students minus the excluded ones, sorted by name. */
  async rosterOf(courseId: string): Promise<Result<Student[]>> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return Result.fail(new NotFoundError('Course', courseId));
    return Result.ok(await this.rosterOfCourse(course));
  }

  async rosterOfCourse(course: Course): Promise<Student[]> {
    const excluded = await this.rosterRepo.findExcludedIds(course.id);
    return CourseRoster.of(await this.studentRepo.findAll(course.schoolClass.id), excluded);
  }

  private async toDto(courseId: string, student: Student, included: boolean): Promise<CourseRosterEntryDto> {
    return {
      studentId: student.id.value,
      firstName: student.name.firstName,
      lastName: student.name.lastName,
      color: student.color?.value ?? null,
      included,
      entryCount: await this.rosterRepo.countEntries(courseId, student.id.value),
    };
  }
}
