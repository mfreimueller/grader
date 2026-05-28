import { Course } from './Course';
import { SchoolYear } from '../student/SchoolYear';

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  findAll(): Promise<Course[]>;
  findBySchoolYear(schoolYear: SchoolYear): Promise<Course[]>;
  save(course: Course): Promise<void>;
  delete(id: string): Promise<void>;
  deleteCategory(courseId: string, categoryId: string): Promise<void>;
}
