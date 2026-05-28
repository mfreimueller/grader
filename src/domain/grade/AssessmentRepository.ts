import { Assessment } from './Assessment';
import { GradedAssessment } from './GradedAssessment';

export interface AssessmentRepository {
  findById(id: string): Promise<Assessment | GradedAssessment | null>;
  findBySession(sessionId: string): Promise<(Assessment | GradedAssessment)[]>;
  save(assessment: Assessment | GradedAssessment): Promise<void>;
  delete(id: string): Promise<void>;
}
