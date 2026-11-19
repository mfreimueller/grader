import fs from "node:fs/promises";
import path from "node:path";
import { isSkippedMaterialPath } from "../../domain/gradeflow/handinFileRules";
import { MaterialRole } from "../../domain/gradeflow/WorkspaceMaterial";
import { ValidationError } from "../../shared/errors";
import { WorkspaceLimits } from "./WorkspaceLimits";
import { isStrictlyInside } from "./workspacePaths";

/**
 * Copies a teacher's assignment or solution folder into the workspace. The files are the teacher's
 * own: not scrubbed, not reported. Symlinks, special files, oversize files and everything
 * `isSkippedMaterialPath` names are left out. Messages never contain paths.
 */
export async function copyMaterialDir(
  role: MaterialRole,
  source: string,
  target: string,
  limits: WorkspaceLimits,
): Promise<void> {
  const tooLarge = (): ValidationError =>
    new ValidationError(`The ${role} folder is too large`);
  let files = 0;
  let bytes = 0;

  const walk = async (relative: string): Promise<void> => {
    const sourceDir = path.join(source, ...relative.split("/").filter(Boolean));
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const entryRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (isSkippedMaterialPath(entryRelative)) continue;
      const targetPath = path.join(target, ...entryRelative.split("/"));
      if (!isStrictlyInside(target, targetPath)) continue;
      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await walk(entryRelative);
      } else if (entry.isFile()) {
        const { size } = await fs.stat(path.join(sourceDir, entry.name));
        if (size > limits.maxFileBytes) continue;
        files += 1;
        bytes += size;
        if (files > limits.maxMaterialFiles || bytes > limits.maxMaterialBytes) {
          throw tooLarge();
        }
        await fs.copyFile(path.join(sourceDir, entry.name), targetPath);
      }
    }
  };

  await fs.mkdir(target, { recursive: true });
  await walk("");
}
