import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BuildWorkspaceInput,
  BuiltWorkspace,
  HandinWorkspaceBuilder,
  WorkspaceReportEntry,
} from "../../domain/gradeflow/HandinWorkspaceBuilder";
import {
  MaterialKind,
  MaterialRole,
  workspaceMaterialName,
} from "../../domain/gradeflow/WorkspaceMaterial";
import type {
  BuildJideWorkspaceInput,
  BuiltJideWorkspace,
  JideWorkspaceBuilder,
  JideWorkspaceFile,
} from "../../domain/gradeflow/JideWorkspaceBuilder";
import { isSkippedMaterialPath } from "../../domain/gradeflow/handinFileRules";
import { Result } from "../../domain/shared/Result";
import { ValidationError } from "../../shared/errors";
import { HandinCopier } from "./HandinCopier";
import { readZip } from "./ZipReader";
import { copyMaterialDir } from "./MaterialCopier";
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

export class FsHandinWorkspaceBuilder implements HandinWorkspaceBuilder, JideWorkspaceBuilder {
  private readonly limits: WorkspaceLimits;

  constructor(limits: Partial<WorkspaceLimits> = {}) {
    this.limits = { ...DEFAULT_WORKSPACE_LIMITS, ...limits };
  }

  async build(input: BuildWorkspaceInput): Promise<Result<BuiltWorkspace>> {
    return this.inNewRoot(async (root) => ({ root, report: await this.populate(root, input) }));
  }

  /** The workspace of a J;DE run: the package as `assignment/`, hand-in files from memory. */
  async buildJide(input: BuildJideWorkspaceInput): Promise<Result<BuiltJideWorkspace>> {
    return this.inNewRoot(async (root) => {
      await this.writePackage(root, input.packageZip);
      await this.writeSchemaAndSkill(root, input.outputInstructions, input.skill);
      const report: WorkspaceReportEntry[] = [];
      const files: JideWorkspaceFile[] = [];
      for (const handin of input.handins) {
        const token = input.pseudonyms.tokenOf(handin.studentId);
        if (token === null) throw new ValidationError("Hand-in without a pseudonym");
        const tokenDir = path.join(root, "handins", token);
        await fs.mkdir(tokenDir, { recursive: true });
        const copier = new HandinCopier(token, tokenDir, input.students, this.limits, report);
        for (const copied of await copier.copyFiles(handin.files)) files.push({ token, ...copied });
      }
      return { root, report, files };
    });
  }

  /** Creates the workspace directory, runs `fill`, and removes the directory again when that fails. */
  private async inNewRoot<T>(fill: (root: string) => Promise<T>): Promise<Result<T>> {
    let root: string | null = null;
    try {
      // realpath: the runner's permission rules match literally (macOS /tmp is /private/tmp).
      root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), WORKSPACE_PREFIX)));
      await fs.chmod(root, 0o700);
      return Result.ok(await fill(root));
    } catch (error) {
      if (root !== null) await fs.rm(root, { recursive: true, force: true });
      return failed(error);
    }
  }

  private async writeSchemaAndSkill(
    root: string,
    outputInstructions: string,
    skill: { id: string; dir: string },
  ): Promise<void> {
    await fs.writeFile(path.join(root, "OUTPUT_SCHEMA.md"), outputInstructions, "utf8");
    await fs.cp(skill.dir, path.join(root, ".claude", "skills", skill.id), {
      recursive: true,
      filter: async (source) => !(await fs.lstat(source)).isSymbolicLink(),
    });
  }

  /** Unpacks the exercise zip into `assignment/` (the teacher's own material: not scrubbed, not reported). */
  private async writePackage(root: string, packageZip: Uint8Array): Promise<void> {
    const staging = await fs.mkdtemp(path.join(os.tmpdir(), "jide-package-"));
    try {
      const zipFile = path.join(staging, "package.zip");
      await fs.writeFile(zipFile, packageZip);
      const archive = await readZip(zipFile, this.limits, isSkippedMaterialPath);
      if (!archive.ok) throw new ValidationError("Das Aufgabenpaket ist ungültig.");
      const target = path.join(root, "assignment");
      await fs.mkdir(target, { recursive: true });
      for (const item of archive.value) {
        if (item.kind !== "file") continue;
        const destination = path.join(target, ...item.name.split("/").filter((s) => s !== "" && s !== "."));
        if (!isStrictlyInside(target, destination)) continue;
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, item.data);
      }
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  private async copyMaterial(
    root: string,
    role: MaterialRole,
    source: string,
    kind: MaterialKind,
  ): Promise<void> {
    const target = path.join(root, workspaceMaterialName(role, kind, path.extname(source)));
    if (kind === "file") await fs.copyFile(source, target);
    else await copyMaterialDir(role, source, target, this.limits);
  }

  private async populate(
    root: string,
    input: BuildWorkspaceInput,
  ): Promise<WorkspaceReportEntry[]> {
    // The teacher's own files are copied as they are: not scrubbed, not reported.
    await this.copyMaterial(root, "assignment", input.assignmentPath, input.assignmentKind);
    if (input.solutionPath !== null && input.solutionKind !== null) {
      await this.copyMaterial(root, "solution", input.solutionPath, input.solutionKind);
    }
    await this.writeSchemaAndSkill(root, input.outputInstructions, input.skill);

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
