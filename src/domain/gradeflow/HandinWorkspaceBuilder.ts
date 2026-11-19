import { Result } from "../shared/Result";
import { ConfirmedHandin } from "./HandinMatcher";
import { LoneNameHit, ScrubStudent } from "./NameScrubber";
import { PseudonymMap } from "./PseudonymMap";
import { MaterialKind } from "./WorkspaceMaterial";

export type WorkspaceEntryKind =
  | "text"
  | "binary"
  | "skipped"
  | "symlink"
  | "too-large"
  | "nested-archive"
  | "archive-error"
  | "unsupported-archive";

/** One line of the pre-flight report. `path` is scrubbed and relative to `handins/<token>/`. */
export interface WorkspaceReportEntry {
  token: string;
  path: string;
  kind: WorkspaceEntryKind;
  replacements?: number;
  loneNameHits?: LoneNameHit[];
  detail?: string;
}

export interface BuildWorkspaceInput {
  handinsDir: string;
  assignmentPath: string;
  assignmentKind: MaterialKind;
  solutionPath: string | null;
  /** Null exactly when `solutionPath` is null. */
  solutionKind: MaterialKind | null;
  handins: ConfirmedHandin[];
  pseudonyms: PseudonymMap;
  students: ScrubStudent[];
  outputInstructions: string;
  skill: { id: string; dir: string };
}

export interface BuiltWorkspace {
  /** Real path (symlinks resolved) of the workspace directory. */
  root: string;
  report: WorkspaceReportEntry[];
}

export interface HandinWorkspaceBuilder {
  build(input: BuildWorkspaceInput): Promise<Result<BuiltWorkspace>>;
  /** Deletes files the teacher excludes; paths are relative to `handins/<token>/`. */
  removeFiles(
    root: string,
    token: string,
    relativePaths: string[],
  ): Promise<Result<void>>;
  /** Removes a workspace built by `build`; refuses any other directory. */
  cleanup(root: string): Promise<Result<void>>;
}
