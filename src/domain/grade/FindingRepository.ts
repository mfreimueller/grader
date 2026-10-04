import { Finding } from './Finding';

/** A text note together with the performance it belongs to. */
export interface PerformanceNote {
  performanceId: string;
  findingId: string;
  text: string;
}

export interface FindingRepository {
  findByPerformance(performanceId: string): Promise<Finding[]>;
  /** Live notes of all live performances of a session, in the order they were saved. */
  findNotesBySession(sessionId: string): Promise<PerformanceNote[]>;
  /** True when the performance exists and is not deleted. */
  performanceExists(performanceId: string): Promise<boolean>;
  save(finding: Finding, performanceId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
