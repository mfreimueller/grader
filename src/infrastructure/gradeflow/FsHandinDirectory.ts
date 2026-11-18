import fs from "node:fs/promises";
import { HandinDirectory } from "../../domain/gradeflow/HandinDirectory";
import { Result } from "../../domain/shared/Result";
import { ValidationError } from "../../shared/errors";

export class FsHandinDirectory implements HandinDirectory {
  async listFolderNames(dir: string): Promise<Result<string[]>> {
    try {
      // Dirent of readdir reports a symlink as a symlink, so isDirectory() is false for it.
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return Result.ok(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort(),
      );
    } catch {
      // No path in the message: it may contain a student's name.
      return Result.fail(new ValidationError("The hand-ins folder cannot be read"));
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      return (await fs.stat(path)).isFile();
    } catch {
      return false;
    }
  }
}
