import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PseudonymMap } from "../../../../src/domain/gradeflow/PseudonymMap";
import type { ConfirmedHandin } from "../../../../src/domain/gradeflow/HandinMatcher";
import type {
  BuildWorkspaceInput,
  BuiltWorkspace,
  WorkspaceReportEntry,
} from "../../../../src/domain/gradeflow/HandinWorkspaceBuilder";
import { FsHandinWorkspaceBuilder } from "../../../../src/infrastructure/gradeflow/FsHandinWorkspaceBuilder";

export const STUDENTS = [
  { id: "s1", firstName: "Max", lastName: "Mustermann" },
  { id: "s2", firstName: "Erika", lastName: "Musterfrau" },
];

export const FOLDER_FILE = "Max Mustermann_111_assignsubmission_file";
export const FOLDER_TEXT = "Max Mustermann_111_assignsubmission_onlinetext";
export const FOLDER_2 = "Erika Musterfrau_222_assignsubmission_file";

export function pseudonyms(): PseudonymMap {
  let counter = 0;
  const result = PseudonymMap.create(
    STUDENTS.map((s) => s.id),
    (max) => counter++ % max,
  );
  if (!result.ok) throw result.error;
  return result.value;
}

export class Harness {
  readonly built: string[] = [];
  src = "";
  handinsDir = "";
  readonly map = pseudonyms();

  async setup(): Promise<void> {
    this.src = await fs.mkdtemp(path.join(os.tmpdir(), "gfsrc-"));
    this.handinsDir = path.join(this.src, "handins");
    await fs.mkdir(this.handinsDir);
    await fs.writeFile(path.join(this.src, "assignment.md"), "# Aufgabe\n");
    await fs.writeFile(path.join(this.src, "solution.java"), "class S {}\n");
    const skill = path.join(this.src, "skill");
    await fs.mkdir(path.join(skill, "refs"), { recursive: true });
    await fs.writeFile(path.join(skill, "SKILL.md"), "---\nname: N\ndescription: D\n---\n");
    await fs.writeFile(path.join(skill, "refs", "a.md"), "ref Max Mustermann");
  }

  async teardown(builder: FsHandinWorkspaceBuilder): Promise<void> {
    for (const root of this.built) await builder.cleanup(root);
    await fs.rm(this.src, { recursive: true, force: true });
  }

  tokenOf(studentId: string): string {
    const token = this.map.tokenOf(studentId);
    if (token === null) throw new Error("no token");
    return token;
  }

  async write(folder: string, relative: string, data: Buffer | string): Promise<string> {
    const file = path.join(this.handinsDir, folder, ...relative.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return file;
  }

  handin(
    studentId: string,
    folders: string[],
    moodleId = studentId === "s1" ? "111" : "222",
  ): ConfirmedHandin {
    return { moodleId, studentId, folders };
  }

  input(
    handins: ConfirmedHandin[],
    overrides: Partial<BuildWorkspaceInput> = {},
  ): BuildWorkspaceInput {
    const merged: BuildWorkspaceInput = {
      handinsDir: this.handinsDir,
      assignmentPath: path.join(this.src, "assignment.md"),
      assignmentKind: "file",
      solutionPath: path.join(this.src, "solution.java"),
      solutionKind: "file",
      handins,
      pseudonyms: this.map,
      students: STUDENTS.map(({ firstName, lastName }) => ({ firstName, lastName })),
      outputInstructions: "# Output\n",
      skill: { id: "grading", dir: path.join(this.src, "skill") },
      ...overrides,
    };
    // No solution path means no solution kind, unless a test says otherwise.
    if (merged.solutionPath === null && overrides.solutionKind === undefined) {
      merged.solutionKind = null;
    }
    return merged;
  }

  async build(
    builder: FsHandinWorkspaceBuilder,
    input: BuildWorkspaceInput,
  ): Promise<BuiltWorkspace> {
    const result = await builder.build(input);
    if (!result.ok) throw result.error;
    this.built.push(result.value.root);
    return result.value;
  }
}

export const entryOf = (
  report: WorkspaceReportEntry[],
  filePath: string,
): WorkspaceReportEntry => {
  const found = report.find((e) => e.path === filePath);
  if (!found) {
    throw new Error(`no report entry for ${filePath}: ${JSON.stringify(report)}`);
  }
  return found;
};

/** All files (relative, `/`-separated) below `dir`, plus directories with a trailing `/`. */
export async function walk(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      out.push(`${rel}/`, ...(await walk(path.join(dir, entry.name), `${rel}/`)));
    } else out.push(rel);
  }
  return out.sort();
}
