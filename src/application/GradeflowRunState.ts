import type { GradingType } from '../domain/grade/GradingType';
import type { AgentModel } from '../domain/gradeflow/AgentRunner';
import type { HandinMatchResult, StudentName } from '../domain/gradeflow/HandinMatcher';
import type { BuiltWorkspace } from '../domain/gradeflow/HandinWorkspaceBuilder';
import type { PseudonymMap } from '../domain/gradeflow/PseudonymMap';
import type { PrepareInput } from '../shared/gradeflow-api';

export type RunPhase = 'prepared' | 'built' | 'running' | 'proposed';

export interface RunAssessment {
  id: string;
  sessionId: string;
  gradingType: GradingType;
  maxPoints: number | null;
}

/** Everything one open Gradeflow run holds. Memory only; tokens (inside `pseudonyms`) never leave the service. */
export interface RunState {
  phase: RunPhase;
  input: PrepareInput;
  assessment: RunAssessment;
  skill: { dir: string; model: AgentModel | null };
  students: (StudentName & { id: string })[];
  match: HandinMatchResult;
  pseudonyms: PseudonymMap | null;
  workspace: BuiltWorkspace | null;
  abort: AbortController | null;
}

export interface CheckedInput {
  assessment: RunAssessment;
  skill: RunState['skill'];
  students: RunState['students'];
}
