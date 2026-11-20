import type { GradingType } from '../domain/grade/GradingType';
import type { AgentModel } from '../domain/gradeflow/AgentRunner';
import type { HandinMatchResult, StudentName } from '../domain/gradeflow/HandinMatcher';
import type { BuiltWorkspace } from '../domain/gradeflow/HandinWorkspaceBuilder';
import type { PseudonymMap } from '../domain/gradeflow/PseudonymMap';
import type { MaterialKind } from '../domain/gradeflow/WorkspaceMaterial';
import type { JideHandin } from '../domain/jide/JideApi';
import type { PrepareInput } from '../shared/gradeflow-api';

export type RunPhase = 'prepared' | 'built' | 'running' | 'proposed';

export interface RunAssessment {
  id: string;
  sessionId: string;
  gradingType: GradingType;
  maxPoints: number | null;
}

/** What a J;DE run holds besides the common state. Memory only; the hand-in files are the students' own data. */
export interface JideRun {
  exercise: { id: string; slug: string; title: string };
  packageZip: Uint8Array;
  /** Every latest hand-in J;DE delivered, by hand-in id. */
  handinsById: ReadonlyMap<string, JideHandin>;
  /** After confirm: the hand-in of each student of the run. */
  handins: Map<string, JideHandin>;
  /** After confirm: per student, the files in the workspace by scrubbed path, with the path J;DE knows. */
  files: Map<string, Map<string, { path: string; lineCount: number }>>;
}

/** Everything one open Gradeflow run holds. Memory only; tokens (inside `pseudonyms`) never leave the service. */
export interface RunState {
  phase: RunPhase;
  input: PrepareInput;
  assignmentKind: MaterialKind;
  /** Null exactly when `input.solutionPath` is null. */
  solutionKind: MaterialKind | null;
  assessment: RunAssessment;
  skill: { dir: string; model: AgentModel | null };
  students: (StudentName & { id: string })[];
  match: HandinMatchResult;
  pseudonyms: PseudonymMap | null;
  workspace: BuiltWorkspace | null;
  abort: AbortController | null;
  /** Set for a J;DE run; then `input` holds no paths and `assignmentKind` is 'directory'. */
  jide: JideRun | null;
}

export interface CheckedJideInput {
  assessment: RunAssessment;
  skill: RunState['skill'];
  students: RunState['students'];
}

export interface CheckedInput {
  assignmentKind: MaterialKind;
  solutionKind: MaterialKind | null;
  assessment: RunAssessment;
  skill: RunState['skill'];
  students: RunState['students'];
}
