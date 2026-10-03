import { StudentRepository } from '../domain/student/StudentRepository';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { StudentId } from '../domain/student/StudentId';
import { NotFoundError } from '../shared/errors';

export interface DeletedStudentDto {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  deletedAt: string;
}

export interface DeletedClassDto {
  id: string;
  name: string;
  schoolYear: string;
  deletedAt: string;
}

export interface DeletedCourseDto {
  id: string;
  title: string;
  className: string;
  schoolYear: string;
  deletedAt: string;
}

export interface BinListDto {
  students: DeletedStudentDto[];
  classes: DeletedClassDto[];
  courses: DeletedCourseDto[];
}

export class BinService {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly classRepo: SchoolClassRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  async listAll(): Promise<BinListDto> {
    const [students, classes, courses] = await Promise.all([
      this.studentRepo.findDeleted(),
      this.classRepo.findDeleted(),
      this.courseRepo.findDeleted(),
    ]);

    return {
      students: students.map((s) => ({
        id: s.id.value,
        firstName: s.name.firstName,
        lastName: s.name.lastName,
        className: s.schoolClass.name,
        deletedAt: s.deletedAt ?? '',
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        schoolYear: c.schoolYear.toString(),
        deletedAt: c.deletedAt ?? '',
      })),
      courses,
    };
  }

  async restoreStudent(id: string): Promise<void> {
    const sidResult = StudentId.create(id);
    if (!sidResult.ok) throw sidResult.error;
    await this.studentRepo.restore(sidResult.value);
  }

  async restoreClass(id: string): Promise<void> {
    await this.classRepo.restoreWithDependents(id);
  }

  async restoreCourse(id: string): Promise<void> {
    await this.requireDeletedCourse(id);
    await this.courseRepo.restore(id);
  }

  async hardDeleteCourse(id: string): Promise<void> {
    await this.requireDeletedCourse(id);
    await this.courseRepo.hardDelete(id);
  }

  private async requireDeletedCourse(id: string): Promise<void> {
    const deleted = await this.courseRepo.findDeleted();
    if (!deleted.some((c) => c.id === id)) throw new NotFoundError('Course', id);
  }

  async hardDeleteStudent(id: string): Promise<void> {
    const sidResult = StudentId.create(id);
    if (!sidResult.ok) throw sidResult.error;

    const deleted = await this.studentRepo.findDeleted();
    const found = deleted.some((s) => s.id.value === id);
    if (!found) throw new NotFoundError('Student', id);

    await this.studentRepo.hardDelete(sidResult.value);
  }

  async hardDeleteClass(id: string): Promise<void> {
    const deleted = await this.classRepo.findDeleted();
    const found = deleted.some((c) => c.id === id);
    if (!found) throw new NotFoundError('SchoolClass', id);

    await this.classRepo.hardDelete(id);
  }

  async emptyBin(): Promise<void> {
    const students = await this.studentRepo.findDeleted();
    for (const s of students) {
      await this.studentRepo.hardDelete(s.id);
    }

    const courses = await this.courseRepo.findDeleted();
    for (const c of courses) {
      await this.courseRepo.hardDelete(c.id);
    }

    const classes = await this.classRepo.findDeleted();
    for (const c of classes) {
      await this.classRepo.hardDelete(c.id);
    }
  }
}
