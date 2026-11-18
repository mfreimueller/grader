import type { AgentRunner } from '../domain/gradeflow/AgentRunner';
import type { HandinDirectory } from '../domain/gradeflow/HandinDirectory';
import type { HandinWorkspaceBuilder } from '../domain/gradeflow/HandinWorkspaceBuilder';
import type { SkillCatalog } from '../domain/gradeflow/SkillCatalog';
import type { AssessmentService } from './AssessmentService';
import type { CourseRosterService } from './CourseRosterService';
import type { FindingService } from './FindingService';
import type { GradingService } from './GradingService';
import type { SessionService } from './SessionService';

export interface GradeflowSettings {
  maxBudgetUsd: number;
  timeoutMs: number;
}

export interface GradeflowDeps {
  rosterService: Pick<CourseRosterService, 'rosterOf'>;
  sessionService: Pick<SessionService, 'listByCourse'>;
  assessmentService: Pick<AssessmentService, 'listBySession'>;
  gradingService: Pick<GradingService, 'recordPerformance' | 'getPerformancesByAssessment'>;
  findingService: Pick<FindingService, 'setNote' | 'listNotesBySession'>;
  workspaceBuilder: HandinWorkspaceBuilder;
  handinDirectory: HandinDirectory;
  skillCatalog: SkillCatalog;
  agentRunner: AgentRunner;
  /** Must return an integer in [0, exclusiveMax); production: `crypto.randomInt`. */
  randomIndex: (exclusiveMax: number) => number;
  settings: () => GradeflowSettings;
  /** Receives lines that contain numbers only. */
  debug?: (line: string) => void;
}

export type * from '../shared/gradeflow-api';
