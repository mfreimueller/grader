import { Course } from './Course';
import { SchoolYear } from '../student/SchoolYear';

export interface DeletedCourseRecord {
  id: string;
  title: string;
  className: string;
  schoolYear: string;
  deletedAt: string;
}

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  findAll(): Promise<Course[]>;
  findBySchoolYear(schoolYear: SchoolYear): Promise<Course[]>;
  save(course: Course): Promise<void>;
  delete(id: string): Promise<void>;
  deleteCategory(courseId: string, categoryId: string): Promise<void>;
  softDelete(id: string, deletedAt: string): Promise<void>;
  findDeleted(): Promise<DeletedCourseRecord[]>;
  restore(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
}
