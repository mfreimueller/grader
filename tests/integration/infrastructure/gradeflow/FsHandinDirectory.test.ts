import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FsHandinDirectory } from "../../../../src/infrastructure/gradeflow/FsHandinDirectory";

describe("FsHandinDirectory", () => {
  let tmp: string;
  const directory = new FsHandinDirectory();

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "handindir-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  describe("listFolderNames", () => {
    it("returns the immediate subdirectories sorted, ignoring files and nesting", async () => {
      await fs.mkdir(path.join(tmp, "b"));
      await fs.mkdir(path.join(tmp, "a", "nested"), { recursive: true });
      await fs.writeFile(path.join(tmp, "notes.txt"), "x");

      const result = await directory.listFolderNames(tmp);

      expect(result).toEqual({ ok: true, value: ["a", "b"] });
    });

    it("does not follow symlinks to directories", async () => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), "handindir-out-"));
      await fs.symlink(outside, path.join(tmp, "link"));
      await fs.mkdir(path.join(tmp, "real"));

      const result = await directory.listFolderNames(tmp);

      expect(result).toEqual({ ok: true, value: ["real"] });
      await fs.rm(outside, { recursive: true, force: true });
    });

    it("returns an empty list for an empty directory", async () => {
      expect(await directory.listFolderNames(tmp)).toEqual({ ok: true, value: [] });
    });

    it("fails with a ValidationError when the path does not exist", async () => {
      const result = await directory.listFolderNames(path.join(tmp, "missing"));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe("ValidationError");
        expect(result.error.message).not.toContain(tmp);
      }
    });

    it("fails when the path is a file", async () => {
      const file = path.join(tmp, "file.txt");
      await fs.writeFile(file, "x");

      const result = await directory.listFolderNames(file);

      expect(result.ok).toBe(false);
    });
  });

  describe("kindOf", () => {
    it("is file for a regular file", async () => {
      const file = path.join(tmp, "a.pdf");
      await fs.writeFile(file, "x");

      expect(await directory.kindOf(file)).toBe("file");
    });

    it("is directory for a folder", async () => {
      expect(await directory.kindOf(tmp)).toBe("directory");
    });

    it("follows a symlink at the top level", async () => {
      const file = path.join(tmp, "a.pdf");
      await fs.writeFile(file, "x");
      await fs.symlink(file, path.join(tmp, "link-file"));
      await fs.mkdir(path.join(tmp, "d"));
      await fs.symlink(path.join(tmp, "d"), path.join(tmp, "link-dir"));

      expect(await directory.kindOf(path.join(tmp, "link-file"))).toBe("file");
      expect(await directory.kindOf(path.join(tmp, "link-dir"))).toBe("directory");
    });

    it("is null for a missing path", async () => {
      expect(await directory.kindOf(path.join(tmp, "missing"))).toBeNull();
    });
  });
});
