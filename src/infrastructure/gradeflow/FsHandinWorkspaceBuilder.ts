import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BuildWorkspaceInput,
  BuiltWorkspace,
  HandinWorkspaceBuilder,
  WorkspaceReportEntry,
} from "../../domain/gradeflow/HandinWorkspaceBuilder";
import { Result } from "../../domain/shared/Result";
import { ValidationError } from "../../shared/errors";
import { HandinCopier } from "./HandinCopier";
import { DEFAULT_WORKSPACE_LIMITS, WorkspaceLimits } from "./WorkspaceLimits";
import { errorCode, isStrictlyInside } from "./workspacePaths";

const WORKSPACE_PREFIX = "gradeflow-";
const TOKEN = /^[a-z0-9]+$/;

/** Messages here may reach the UI: they must never contain paths (those hold student names). */
const fail = <T>(message: string): Result<T> =>
  Result.fail(new ValidationError(message));

const failed = <T>(error: unknown): Result<T> =>
  error instanceof ValidationError
    ? Result.fail(error)
    : fail(`Workspace operation failed (${errorCode(error)})`);

/** The real path of `root` if it is a direct `gradeflow-*` child of the real tmp dir. */
async function workspaceRootOf(root: string): Promise<string | null> {
  const name = path.basename(root);
  if (
    !path.isAbsolute(root) ||
    !name.startsWith(WORKSPACE_PREFIX) ||
    name.length === WORKSPACE_PREFIX.length
  ) {
    return null;
  }
  try {
    const parent = await fs.realpath(path.dirname(root));
    return parent === (await fs.realpath(os.tmpdir())) ? path.join(parent, name) : null;
  } catch {
    return null;
  }
}

async function assertHandinFolder(handinsDir: string, folder: string): Promise<string> {
  if (folder === "" || folder === "." || folder === ".." || /[\\/\0]/.test(folder)) {
    throw new ValidationError("Invalid hand-in folder name");
  }
  const abs = path.join(handinsDir, folder);
  const stat = await fs.lstat(abs).catch(() => null);
  if (stat === null || !stat.isDirectory()) {
    throw new ValidationError("Hand-in folder not found");
  }
  return abs;
}

export class FsHandinWorkspaceBuilder implements HandinWorkspaceBuilder {
  private readonly limits: WorkspaceLimits;

  constructor(limits: Partial<WorkspaceLimits> = {}) {
    this.limits = { ...DEFAULT_WORKSPACE_LIMITS, ...limits };
  }

  async build(input: BuildWorkspaceInput): Promise<Result<BuiltWorkspace>> {
    let root: string | null = null;
    try {
      // realpath: the runner's permission rules match literally (macOS /tmp is /private/tmp).
      root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), WORKSPACE_PREFIX)));
      await fs.chmod(root, 0o700);
      const report = await this.populate(root, input);
      return Result.ok({ root, report });
    } catch (error) {
      if (root !== null) await fs.rm(root, { recursive: true, force: true });
      return failed(error);
    }
  }

  private async populate(
    root: string,
    input: BuildWorkspaceInput,
  ): Promise<WorkspaceReportEntry[]> {
    // The teacher's own files are copied as they are: not scrubbed, not reported.
    await fs.copyFile(
      input.assignmentPath,
      path.join(root, `ASSIGNMENT${path.extname(input.assignmentPath)}`),
    );
    if (input.solutionPath !== null) {
      await fs.copyFile(
        input.solutionPath,
        path.join(root, `SOLUTION${path.extname(input.solutionPath)}`),
      );
    }
    await fs.writeFile(path.join(root, "OUTPUT_SCHEMA.md"), input.outputInstructions, "utf8");
    await fs.cp(input.skill.dir, path.join(root, ".claude", "skills", input.skill.id), {
      recursive: true,
      filter: async (source) => !(await fs.lstat(source)).isSymbolicLink(),
    });

    const report: WorkspaceReportEntry[] = [];
    const copiers = new Map<string, HandinCopier>();
    for (const handin of input.handins) {
      const token = input.pseudonyms.tokenOf(handin.studentId);
      if (token === null) throw new ValidationError("Hand-in without a pseudonym");
      const tokenDir = path.join(root, "handins", token);
      await fs.mkdir(tokenDir, { recursive: true });
      let copier = copiers.get(token);
      if (copier === undefined) {
        copier = new HandinCopier(token, tokenDir, input.students, this.limits, report);
        copiers.set(token, copier);
      }
      for (const folder of handin.folders) {
        await copier.copyFolder(await assertHandinFolder(input.handinsDir, folder));
      }
    }
    return report;
  }

  async removeFiles(
    root: string,
    token: string,
    relativePaths: string[],
  ): Promise<Result<void>> {
    const realRoot = await workspaceRootOf(root);
    if (realRoot === null || !TOKEN.test(token)) return fail("Not a workspace or token");
    const tokenDir = path.join(realRoot, "handins", token);

    const targets: string[] = [];
    for (const relative of relativePaths) {
      const normalised = relative.replace(/\\/g, "/");
      const segments = normalised.split("/");
      const target = path.join(tokenDir, ...segments);
      if (
        normalised.includes("\0") ||
        path.posix.isAbsolute(normalised) ||
        /^[A-Za-z]:/.test(normalised) ||
        segments.some((s) => s === "" || s === "." || s === "..") ||
        !isStrictlyInside(tokenDir, target)
      ) {
        return fail("Path is outside the hand-in");
      }
      targets.push(target);
    }
    try {
      for (const target of targets) await fs.rm(target, { force: true });
      return Result.ok(undefined);
    } catch (error) {
      return failed(error);
    }
  }

  async cleanup(root: string): Promise<Result<void>> {
    const realRoot = await workspaceRootOf(root);
    if (realRoot === null) return fail("Not a Gradeflow workspace");
    try {
      await fs.rm(realRoot, { recursive: true, force: true });
      return Result.ok(undefined);
    } catch (error) {
      return failed(error);
    }
  }
}
