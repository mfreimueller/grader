import { Result } from "../shared/Result";
import type { JideHandinFile } from "../jide/JideApi";
import type { BuiltWorkspace } from "./HandinWorkspaceBuilder";
import type { ScrubStudent } from "./NameScrubber";
import type { PseudonymMap } from "./PseudonymMap";

export interface BuildJideWorkspaceInput {
  /** The exercise zip as J;DE delivers it: `exercise.yaml`, `aufgabe.md`, `files/`, `tests.yaml`, ... */
  packageZip: Uint8Array;
  handins: { studentId: string; files: JideHandinFile[] }[];
  pseudonyms: PseudonymMap;
  students: ScrubStudent[];
  outputInstructions: string;
  skill: { id: string; dir: string };
}

/** One hand-in file as it lies in the workspace. */
export interface JideWorkspaceFile {
  token: string;
  /** Name-scrubbed path below `handins/<token>/`: what the agent sees and writes in line comments. */
  path: string;
  /** The path in the hand-in as J;DE knows it. */
  originalPath: string;
  /** Lines of the file; 0 when line comments on it cannot be trusted (binary, or scrubbing changed the line count). */
  lineCount: number;
}

export interface BuiltJideWorkspace extends BuiltWorkspace {
  files: JideWorkspaceFile[];
}

/**
 * Builds the workspace of a J;DE run: the exercise package as `assignment/`, the hand-ins in `handins/<token>/`.
 * Hand-in files get the same name scrubbing, file rules and pre-flight report as Moodle hand-ins.
 */
export interface JideWorkspaceBuilder {
  buildJide(input: BuildJideWorkspaceInput): Promise<Result<BuiltJideWorkspace>>;
}
