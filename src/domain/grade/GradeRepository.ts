import { Grade } from './Grade';
import { StudentId } from '../student/StudentId';

export interface GradeRepository {
  findByStudent(studentId: StudentId): Promise<Grade[]>;
  findByCourseAndStudent(courseId: string, studentId: StudentId): Promise<Grade | null>;
  save(grade: Grade): Promise<void>;
  delete(id: string): Promise<void>;
}
