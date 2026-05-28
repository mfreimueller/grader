import { Finding } from './Finding';

export interface FindingRepository {
  findByPerformance(performanceId: string): Promise<Finding[]>;
  save(finding: Finding, performanceId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
