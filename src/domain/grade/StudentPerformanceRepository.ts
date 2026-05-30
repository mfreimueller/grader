import { StudentPerformance } from './StudentPerformance';
import { StudentId } from '../student/StudentId';

export interface StudentPerformanceRepository {
  findPerformancesByAssessment(assessmentId: string): Promise<StudentPerformance[]>;
  findPerformancesByStudent(studentId: StudentId): Promise<StudentPerformance[]>;
  savePerformance(performance: StudentPerformance): Promise<void>;
  deletePerformance(id: string): Promise<void>;
}
