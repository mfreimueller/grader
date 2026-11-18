import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FsHandinWorkspaceBuilder } from "../../../../src/infrastructure/gradeflow/FsHandinWorkspaceBuilder";
import { buildZip, unicodePathField } from "./zipFixture";
import {
  FOLDER_FILE,
  FOLDER_TEXT,
  Harness,
  entryOf,
  walk,
} from "./workspaceHarness";

const kb = (n: number): Buffer => Buffer.alloc(n * 1024, 0x61);

describe("FsHandinWorkspaceBuilder", () => {
  let h: Harness;
  let builder: FsHandinWorkspaceBuilder;

  beforeEach(async () => {
    h = new Harness();
    await h.setup();
    builder = new FsHandinWorkspaceBuilder();
  });

  afterEach(async () => {
    await h.teardown(builder);
  });

  const buildOne = async (
    options?: ConstructorParameters<typeof FsHandinWorkspaceBuilder>[0],
    folders = [FOLDER_FILE],
  ) => {
    const b = options ? new FsHandinWorkspaceBuilder(options) : builder;
    for (const folder of folders) {
      await fs.mkdir(path.join(h.handinsDir, folder), { recursive: true });
    }
    const workspace = await h.build(b, h.input([h.handin("s1", folders)]));
    const token = h.tokenOf("s1");
    return { workspace, token, dir: path.join(workspace.root, "handins", token) };
  };

  describe("layout", () => {
    it("creates a private workspace on the real tmp path with all teacher files", async () => {
      await h.write(FOLDER_FILE, "Main.java", "class Main {}");
      const { workspace, token } = await buildOne();

      expect(workspace.root).toBe(await fs.realpath(workspace.root));
      expect(path.dirname(workspace.root)).toBe(await fs.realpath(os.tmpdir()));
      expect(path.basename(workspace.root)).toMatch(/^gradeflow-/);
      if (process.platform !== "win32") {
        expect((await fs.stat(workspace.root)).mode & 0o777).toBe(0o700);
      }
      expect(await walk(workspace.root)).toEqual([
        ".claude/",
        ".claude/skills/",
        ".claude/skills/grading/",
        ".claude/skills/grading/SKILL.md",
        ".claude/skills/grading/refs/",
        ".claude/skills/grading/refs/a.md",
        "ASSIGNMENT.md",
        "OUTPUT_SCHEMA.md",
        "SOLUTION.java",
        "handins/",
        `handins/${token}/`,
        `handins/${token}/Main.java`,
      ]);
    });

    it("copies the teacher's files verbatim, without scrubbing or reporting them", async () => {
      const { workspace } = await buildOne();
      expect(await fs.readFile(path.join(workspace.root, "ASSIGNMENT.md"), "utf8")).toBe("# Aufgabe\n");
      expect(await fs.readFile(path.join(workspace.root, "OUTPUT_SCHEMA.md"), "utf8")).toBe("# Output\n");
      expect(
        await fs.readFile(path.join(workspace.root, ".claude/skills/grading/refs/a.md"), "utf8"),
      ).toBe("ref Max Mustermann");
      expect(workspace.report).toEqual([]);
    });

    it("omits SOLUTION when none is given and does not copy symlinks of the skill", async () => {
      await fs.mkdir(path.join(h.handinsDir, FOLDER_FILE));
      await fs.symlink(h.src, path.join(h.src, "skill", "link"));
      const workspace = await h.build(
        builder,
        h.input([h.handin("s1", [FOLDER_FILE])], { solutionPath: null }),
      );
      const files = await walk(workspace.root);
      expect(files.some((f) => f.startsWith("SOLUTION"))).toBe(false);
      expect(files.some((f) => f.endsWith("/link"))).toBe(false);
    });

    it("creates an empty directory for a hand-in without files", async () => {
      await fs.mkdir(path.join(h.handinsDir, FOLDER_FILE));
      const { dir } = await buildOne();
      expect(await fs.readdir(dir)).toEqual([]);
    });
  });

  describe("text files", () => {
    it("scrubs full names in content and reports counts and lone names", async () => {
      await h.write(
        FOLDER_FILE,
        "Main.java",
        "// Max Mustermann\n// Mustermann, Max\nint max = 1; String s = \"Mustermann\";\n",
      );
      const { workspace, dir } = await buildOne();

      expect(await fs.readFile(path.join(dir, "Main.java"), "utf8")).toBe(
        "// STUDENT\n// STUDENT\nint max = 1; String s = \"Mustermann\";\n",
      );
      const entry = entryOf(workspace.report, "Main.java");
      expect(entry.kind).toBe("text");
      expect(entry.token).toBe(h.tokenOf("s1"));
      expect(entry.replacements).toBe(2);
      expect(entry.loneNameHits).toEqual(
        expect.arrayContaining([
          { name: "Mustermann", count: 1 },
          { name: "Max", count: 1 },
        ]),
      );
    });

    describe("text encodings", () => {
      const mueller = [{ firstName: "Max", lastName: "Müller" }];
      const buildMueller = async () => {
        await fs.mkdir(path.join(h.handinsDir, FOLDER_FILE), { recursive: true });
        const workspace = await h.build(
          builder,
          h.input([h.handin("s1", [FOLDER_FILE])], { students: mueller }),
        );
        return { workspace, dir: path.join(workspace.root, "handins", h.tokenOf("s1")) };
      };

      it("scrubs a name in a Windows-1252 file and writes UTF-8", async () => {
        const bytes = Buffer.concat([
          Buffer.from("// Author: Max M"),
          Buffer.from([0xfc]),
          Buffer.from("ller\nint a = 1; // \u00e4\n", "latin1"),
        ]);
        await h.write(FOLDER_FILE, "A.java", bytes);
        const { workspace, dir } = await buildMueller();
        const out = await fs.readFile(path.join(dir, "A.java"));
        expect(out.toString("utf8")).toBe("// Author: STUDENT\nint a = 1; // ä\n");
        expect(entryOf(workspace.report, "A.java")).toMatchObject({
          kind: "text",
          replacements: 1,
          detail: "converted from windows-1252",
        });
      });

      it("scrubs a name in UTF-16LE and UTF-16BE files and writes UTF-8 without BOM", async () => {
        const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("// Max Müller\nx\n", "utf16le")]);
        const be = Buffer.from(le.subarray(2)).swap16();
        await h.write(FOLDER_FILE, "le.txt", le);
        await h.write(FOLDER_FILE, "be.txt", Buffer.concat([Buffer.from([0xfe, 0xff]), be]));
        const { workspace, dir } = await buildMueller();
        for (const [file, enc] of [["le.txt", "utf16le"], ["be.txt", "utf16be"]] as const) {
          expect(await fs.readFile(path.join(dir, file))).toEqual(Buffer.from("// STUDENT\nx\n"));
          expect(entryOf(workspace.report, file)).toMatchObject({
            kind: "text",
            replacements: 1,
            detail: `converted from ${enc}`,
          });
        }
      });

      it("keeps a UTF-8 BOM and reports no conversion for UTF-8", async () => {
        await h.write(FOLDER_FILE, "bom.txt", Buffer.from("\uFEFF// Max Müller\n", "utf8"));
        const { workspace, dir } = await buildMueller();
        expect(await fs.readFile(path.join(dir, "bom.txt"))).toEqual(
          Buffer.from("\uFEFF// STUDENT\n", "utf8"),
        );
        expect(entryOf(workspace.report, "bom.txt").detail).toBeUndefined();
      });

      it("still copies other single-byte data with control bytes as binary", async () => {
        await h.write(FOLDER_FILE, "x.bin", Buffer.from([0xfc, 0x01, 0x02]));
        const { workspace } = await buildMueller();
        expect(entryOf(workspace.report, "x.bin").kind).toBe("binary");
      });
    });

    it("scrubs file and directory names and reports their lone-name hits", async () => {
      await h.write(FOLDER_FILE, "Mustermann_Max_Uebung3.java", "x");
      await h.write(FOLDER_FILE, "Mustermann/Notes.txt", "y");
      const { workspace, dir } = await buildOne();

      expect(await walk(dir)).toEqual([
        "Mustermann/",
        "Mustermann/Notes.txt",
        "STUDENT_Uebung3.java",
      ]);
      expect(entryOf(workspace.report, "STUDENT_Uebung3.java").replacements).toBe(1);
      expect(entryOf(workspace.report, "Mustermann/Notes.txt").loneNameHits).toEqual([
        { name: "Mustermann", count: 1 },
      ]);
    });

    it("inherits name replacements of a directory into the files below it", async () => {
      await h.write(FOLDER_FILE, "Max_Mustermann/sub/a.txt", "hello");
      const { workspace } = await buildOne();
      const entry = entryOf(workspace.report, "STUDENT/sub/a.txt");
      expect(entry.kind).toBe("text");
      expect(entry.replacements).toBe(1);
    });

    it("merges both folders of a hand-in and numbers colliding names", async () => {
      await h.write(FOLDER_FILE, "Main.java", "file");
      await h.write(FOLDER_TEXT, "Main.java", "text");
      await h.write(FOLDER_TEXT, "Main (2).java", "third");
      await h.write(FOLDER_TEXT, "README", "r1");
      await h.write(FOLDER_FILE, "readme", "r2");
      const { dir } = await buildOne(undefined, [FOLDER_FILE, FOLDER_TEXT]);

      expect(await walk(dir)).toEqual([
        "Main (2).java",
        "Main (3).java",
        "Main.java",
        "README (2)",
        "readme",
      ]);
      expect(await fs.readFile(path.join(dir, "Main.java"), "utf8")).toBe("file");
      expect(await fs.readFile(path.join(dir, "Main (3).java"), "utf8")).toBe("text");
      expect(await fs.readFile(path.join(dir, "Main (2).java"), "utf8")).toBe("third");
    });

    it("numbers names that collide after scrubbing", async () => {
      await h.write(FOLDER_FILE, "Mustermann_Max_a.java", "1");
      await h.write(FOLDER_FILE, "Max_Mustermann_a.java", "2");
      await h.write(FOLDER_FILE, "Max Mustermann_a.java", "3");
      const { dir } = await buildOne();
      expect(await walk(dir)).toEqual([
        "STUDENT_a (2).java",
        "STUDENT_a (3).java",
        "STUDENT_a.java",
      ]);
    });

    it("lets a file with the name of a directory get a number", async () => {
      await h.write(FOLDER_TEXT, "lib/x.txt", "x");
      await h.write(FOLDER_FILE, "lib", "file");
      const { dir } = await buildOne(undefined, [FOLDER_FILE, FOLDER_TEXT]);
      expect(await walk(dir)).toEqual(["lib", "lib (2)/", "lib (2)/x.txt"]);
    });
  });

  describe("binary, size, skip and symlink rules", () => {
    it("copies binary files verbatim and reports them", async () => {
      const bytes = Buffer.from([0x89, 0x50, 0x00, 0x01, 0xff]);
      await h.write(FOLDER_FILE, "Max_Mustermann.png", bytes);
      const { workspace, dir } = await buildOne();
      expect(await fs.readFile(path.join(dir, "STUDENT.png"))).toEqual(bytes);
      expect(entryOf(workspace.report, "STUDENT.png")).toMatchObject({
        kind: "binary",
        replacements: 1,
      });
    });

    it("does not copy files above the size limit", async () => {
      await h.write(FOLDER_FILE, "big.txt", kb(3));
      await h.write(FOLDER_FILE, "ok.txt", kb(1));
      const { workspace, dir } = await buildOne({ maxFileBytes: 2048 });
      expect(await walk(dir)).toEqual(["ok.txt"]);
      expect(entryOf(workspace.report, "big.txt").kind).toBe("too-large");
    });

    it("uses 2 MiB as the default size limit", async () => {
      await h.write(FOLDER_FILE, "edge.txt", Buffer.alloc(2 * 1024 * 1024, 0x61));
      await h.write(FOLDER_FILE, "over.txt", Buffer.alloc(2 * 1024 * 1024 + 1, 0x61));
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual(["edge.txt"]);
      expect(entryOf(workspace.report, "over.txt").kind).toBe("too-large");
    });

    it("skips build output and tooling once per top directory", async () => {
      await h.write(FOLDER_FILE, ".git/config", "x");
      await h.write(FOLDER_FILE, ".git/objects/ab/cd", "x");
      await h.write(FOLDER_FILE, "src/node_modules/m/i.js", "x");
      await h.write(FOLDER_FILE, "src/Main.java", "x");
      await h.write(FOLDER_FILE, "src/Main.class", "x");
      await h.write(FOLDER_FILE, ".DS_Store", "x");
      const { workspace, dir } = await buildOne();

      expect(await walk(dir)).toEqual(["src/", "src/Main.java"]);
      const skipped = workspace.report.filter((e) => e.kind === "skipped").map((e) => e.path);
      expect(skipped.sort()).toEqual([".DS_Store", ".git", "src/Main.class", "src/node_modules"]);
    });

    it("does not follow or copy symlinks", async () => {
      const outside = path.join(h.src, "secret.txt");
      await fs.writeFile(outside, "top secret");
      await fs.mkdir(path.join(h.handinsDir, FOLDER_FILE));
      await fs.symlink(outside, path.join(h.handinsDir, FOLDER_FILE, "link.txt"));
      await fs.symlink(h.src, path.join(h.handinsDir, FOLDER_FILE, "linkdir"));
      const { workspace, dir } = await buildOne();

      expect(await walk(dir)).toEqual([]);
      expect(entryOf(workspace.report, "link.txt").kind).toBe("symlink");
      expect(entryOf(workspace.report, "linkdir").kind).toBe("symlink");
    });
  });

  describe("archives", () => {
    const zipOf = (...args: Parameters<typeof buildZip>): Buffer => buildZip(...args);

    it("unpacks a zip into a scrubbed directory and applies the file rules", async () => {
      await h.write(
        FOLDER_FILE,
        "Mustermann_Max_Abgabe.zip",
        zipOf([
          { name: "src/Main.java", data: "// Max Mustermann\nclass Main {}" },
          { name: "src/Max_Mustermann.txt", data: "n" },
          { name: "logo.png", data: Buffer.from([0, 1, 2]) },
          { name: ".git/config", data: "x" },
          { name: "node_modules/x/y.js", data: "x" },
          { name: "__MACOSX/._a", data: "x" },
          { name: "empty/", data: "" },
          { name: "link", data: "target", mode: 0o120777 },
          { name: "big.txt", data: kb(5) },
          { name: "lib.rar", data: "rar" },
          { name: "lib.zip", data: zipOf([{ name: "inner.txt", data: "inner" }]) },
        ]),
      );
      const { workspace, dir } = await buildOne({ maxFileBytes: 4096 });

      expect(await walk(dir)).toEqual([
        "STUDENT_Abgabe/",
        "STUDENT_Abgabe/lib.zip",
        "STUDENT_Abgabe/logo.png",
        "STUDENT_Abgabe/src/",
        "STUDENT_Abgabe/src/Main.java",
        "STUDENT_Abgabe/src/STUDENT.txt",
      ]);
      expect(
        await fs.readFile(path.join(dir, "STUDENT_Abgabe/src/Main.java"), "utf8"),
      ).toBe("// STUDENT\nclass Main {}");

      const kinds = Object.fromEntries(workspace.report.map((e) => [e.path, e.kind]));
      expect(kinds).toMatchObject({
        "STUDENT_Abgabe/src/Main.java": "text",
        "STUDENT_Abgabe/logo.png": "binary",
        "STUDENT_Abgabe/.git": "skipped",
        "STUDENT_Abgabe/node_modules": "skipped",
        "STUDENT_Abgabe/__MACOSX": "skipped",
        "STUDENT_Abgabe/link": "symlink",
        "STUDENT_Abgabe/big.txt": "too-large",
        "STUDENT_Abgabe/lib.rar": "unsupported-archive",
        "STUDENT_Abgabe/lib.zip": "nested-archive",
      });
      expect(workspace.report.filter((e) => e.path.includes(".git"))).toHaveLength(1);
      expect(kinds["Mustermann_Max_Abgabe.zip"]).toBeUndefined();
    });

    it("reports unsafe entry names and still extracts the safe ones", async () => {
      await h.write(
        FOLDER_FILE,
        "a.zip",
        zipOf([
          { name: "../evil.txt", data: "x" },
          { name: "/abs.txt", data: "x" },
          { name: "C:/win.txt", data: "x" },
          { name: "sub\\..\\..\\back.txt", data: "x" },
          { name: "good.txt", data: "ok" },
        ]),
      );
      const { workspace, dir } = await buildOne();

      expect(await walk(dir)).toEqual(["a/", "a/good.txt"]);
      const errors = workspace.report.filter((e) => e.kind === "archive-error");
      expect(errors).toHaveLength(4);
      expect(await walk(workspace.root)).not.toContain("evil.txt");
      await expect(fs.stat(path.join(path.dirname(workspace.root), "evil.txt"))).rejects.toThrow();
      await expect(fs.stat(path.join(workspace.root, "handins", "evil.txt"))).rejects.toThrow();
    });

    it("reports encrypted entries", async () => {
      await h.write(
        FOLDER_FILE,
        "a.zip",
        zipOf([{ name: "secret.txt", data: "x", encrypted: true }, { name: "ok.txt", data: "y" }]),
      );
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual(["a/", "a/ok.txt"]);
      expect(entryOf(workspace.report, "a/secret.txt")).toMatchObject({
        kind: "archive-error",
        detail: "encrypted",
      });
    });

    it("aborts an archive with too many entries and extracts nothing of it", async () => {
      await h.write(
        FOLDER_FILE,
        "many.zip",
        zipOf(Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.txt`, data: "x" }))),
      );
      await h.write(FOLDER_FILE, "keep.txt", "k");
      const { workspace, dir } = await buildOne({ maxArchiveEntries: 4 });
      expect(await walk(dir)).toEqual(["keep.txt"]);
      expect(entryOf(workspace.report, "many.zip")).toMatchObject({ kind: "archive-error" });
    });

    it("aborts an archive above the total size limit and removes what it extracted", async () => {
      await h.write(
        FOLDER_FILE,
        "heavy.zip",
        zipOf([
          { name: "a.txt", data: kb(1) },
          { name: "b.txt", data: kb(1) },
          { name: "c.txt", data: kb(1) },
        ]),
      );
      const { workspace, dir } = await buildOne({ maxArchiveBytes: 2500 });
      expect(await walk(dir)).toEqual([]);
      expect(workspace.report.map((e) => [e.path, e.kind])).toEqual([
        ["heavy.zip", "archive-error"],
      ]);
    });

    it("reports a corrupt zip and does not copy it", async () => {
      await h.write(FOLDER_FILE, "broken.zip", "this is not a zip");
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual([]);
      expect(entryOf(workspace.report, "broken.zip")).toMatchObject({
        kind: "archive-error",
        detail: "corrupt archive",
      });
    });

    it("reports an archive whose entry data does not match its declared size", async () => {
      const zip = zipOf([{ name: "a.txt", data: "hello" }]);
      const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
      zip.writeUInt32LE(99, central + 24); // lie about the uncompressed size
      await h.write(FOLDER_FILE, "liar.zip", zip);
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual([]);
      expect(entryOf(workspace.report, "liar.zip").kind).toBe("archive-error");
    });

    describe("entry name encodings", () => {
      const mueller = [{ firstName: "Max", lastName: "Müller" }];
      const cp437Name = Buffer.from([0x4d, 0x81, 0x6c, 0x6c, 0x65, 0x72, 0x5f, 0x4d, 0x61, 0x78, 0x2e, 0x6a, 0x61, 0x76, 0x61]); // M\x81ller_Max.java

      const extractWith = async (entry: Parameters<typeof buildZip>[0][number]) => {
        await h.write(FOLDER_FILE, "z.zip", zipOf([entry]));
        const workspace = await h.build(
          builder,
          h.input([h.handin("s1", [FOLDER_FILE])], { students: mueller }),
        );
        const dir = path.join(workspace.root, "handins", h.tokenOf("s1"));
        return { workspace, files: await walk(dir) };
      };

      it("decodes names without the UTF-8 flag as CP437 and scrubs them", async () => {
        const { workspace, files } = await extractWith({
          name: "ignored",
          rawName: cp437Name,
          utf8Flag: false,
          data: "x",
        });
        expect(files).toEqual(["z/", "z/STUDENT.java"]);
        expect(JSON.stringify(workspace.report)).not.toMatch(/ller|Max/);
      });

      it("decodes names with the UTF-8 flag as UTF-8", async () => {
        const { files } = await extractWith({ name: "Müller_Max.java", data: "x" });
        expect(files).toEqual(["z/", "z/STUDENT.java"]);
      });

      it("prefers a Unicode Path field whose CRC matches the stored name", async () => {
        const rawName = Buffer.from("x.java");
        const { files } = await extractWith({
          name: "x",
          rawName,
          utf8Flag: false,
          extra: unicodePathField("Müller_Max.java", rawName),
          data: "x",
        });
        expect(files).toEqual(["z/", "z/STUDENT.java"]);
      });

      it("ignores a Unicode Path field whose CRC does not match", async () => {
        const rawName = Buffer.from("x.java");
        const { files } = await extractWith({
          name: "x",
          rawName,
          utf8Flag: false,
          extra: unicodePathField("Müller_Max.java", rawName, 1234),
          data: "x",
        });
        expect(files).toEqual(["z/", "z/x.java"]);
      });

      it("ignores malformed Unicode Path fields", async () => {
        const rawName = Buffer.from("x.java");
        const bad = unicodePathField("Müller_Max.java", rawName);
        bad.writeUInt8(2, 4); // unknown version
        const short = Buffer.from([0x75, 0x70, 0x02, 0x00, 0x01, 0x00]);
        for (const extra of [bad, short]) {
          const { files } = await extractWith({ name: "x", rawName, utf8Flag: false, extra, data: "x" });
          expect(files).toContain("z/x.java");
          await fs.rm(path.join(h.handinsDir, FOLDER_FILE), { recursive: true });
          await fs.mkdir(path.join(h.handinsDir, FOLDER_FILE));
        }
      });
    });

    it("aborts an archive whose stored data is larger than declared", async () => {
      await h.write(
        FOLDER_FILE,
        "over.zip",
        zipOf([{ name: "a.txt", data: "x".repeat(50), declaredSize: 10 }]),
      );
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual([]);
      expect(entryOf(workspace.report, "over.zip").kind).toBe("archive-error");
    });

    it("unpacks deflated entries", async () => {
      await h.write(FOLDER_FILE, "d.zip", zipOf([{ name: "a.txt", data: "hello ".repeat(100), deflate: true }]));
      const { dir } = await buildOne();
      expect(await fs.readFile(path.join(dir, "d", "a.txt"), "utf8")).toBe("hello ".repeat(100));
    });

    it("aborts an archive whose deflated data is larger than declared (zip bomb)", async () => {
      await h.write(
        FOLDER_FILE,
        "bomb.zip",
        zipOf([{ name: "a.txt", data: "x".repeat(5000), deflate: true, declaredSize: 10 }]),
      );
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual([]);
      expect(entryOf(workspace.report, "bomb.zip")).toMatchObject({
        kind: "archive-error",
        detail: "corrupt archive",
      });
    });

    it("does not copy other archive formats", async () => {
      await h.write(FOLDER_FILE, "a.rar", "x");
      await h.write(FOLDER_FILE, "b.7z", "x");
      const { workspace, dir } = await buildOne();
      expect(await walk(dir)).toEqual([]);
      expect(workspace.report.map((e) => e.kind)).toEqual(["unsupported-archive", "unsupported-archive"]);
    });

    it("unpacks a zip above the single-file size limit", async () => {
      await h.write(FOLDER_FILE, "a.zip", zipOf([{ name: "x.txt", data: kb(2) }]));
      const { dir } = await buildOne({ maxFileBytes: 1024, maxArchiveBytes: 100 * 1024 });
      expect(await walk(dir)).toEqual(["a/"]);
    });

    it("places a zip's folder next to other files of the same name", async () => {
      await h.write(FOLDER_FILE, "a", "a file");
      await h.write(FOLDER_FILE, "a.zip", zipOf([{ name: "x.txt", data: "x" }]));
      const { dir } = await buildOne();
      expect(await walk(dir)).toEqual(["a", "a (2)/", "a (2)/x.txt"]);
    });
  });

  describe("report hygiene", () => {
    it("never contains an original name or path", async () => {
      await h.write(FOLDER_FILE, "Max_Mustermann/Mustermann_Max.zip", buildZip([{ name: "Max Mustermann/a.txt", data: "Max Mustermann" }, { name: "../Mustermann_Max.txt", data: "x" }]));
      await h.write(FOLDER_FILE, "Max Mustermann.rar", "x");
      await h.write(FOLDER_FILE, "Mustermann_Max.class", "x");
      await h.write(FOLDER_FILE, "Max_Mustermann/link-target.txt", "x");
      await fs.symlink("x", path.join(h.handinsDir, FOLDER_FILE, "Max_Mustermann_link"));
      const { workspace } = await buildOne();
      const reportText = JSON.stringify(workspace.report);
      expect(reportText).not.toMatch(/max[ _.-]?mustermann|mustermann[ _.-]?max/i);
      expect(workspace.report.length).toBeGreaterThan(4);
    });
  });

  describe("failures", () => {
    const gradeflowDirs = async (): Promise<string[]> =>
      (await fs.readdir(os.tmpdir())).filter((n) => n.startsWith("gradeflow-")).sort();

    it("removes the partly built workspace when a hand-in folder is missing", async () => {
      const before = await gradeflowDirs();
      const result = await builder.build(h.input([h.handin("s1", ["Nope_1_assignsubmission_file"])]));
      expect(result.ok).toBe(false);
      expect(await gradeflowDirs()).toEqual(before);
    });

    it("fails without leaving a workspace for a missing assignment or skill", async () => {
      const before = await gradeflowDirs();
      const noAssignment = await builder.build(
        h.input([], { assignmentPath: path.join(h.src, "missing.md") }),
      );
      const noSkill = await builder.build(
        h.input([], { skill: { id: "x", dir: path.join(h.src, "missing") } }),
      );
      expect(noAssignment.ok).toBe(false);
      expect(noSkill.ok).toBe(false);
      expect(await gradeflowDirs()).toEqual(before);
    });

    it("fails for a missing solution", async () => {
      const result = await builder.build(h.input([], { solutionPath: path.join(h.src, "nope.java") }));
      expect(result.ok).toBe(false);
    });

    it("fails for folder names that are paths, and for a symlinked folder", async () => {
      await fs.symlink(h.src, path.join(h.handinsDir, "linked"));
      for (const folder of ["../x", "a/b", "a\\b", "..", "linked"]) {
        const result = await builder.build(h.input([h.handin("s1", [folder])]));
        expect(result.ok).toBe(false);
      }
    });

    it("fails for a hand-in whose student has no token", async () => {
      const result = await builder.build(h.input([h.handin("unknown", [FOLDER_FILE])]));
      expect(result.ok).toBe(false);
    });

    it("does not leak paths with names into error messages", async () => {
      const result = await builder.build(h.input([h.handin("s1", ["Max Mustermann_9_x"])]));
      expect(!result.ok && result.error.message).not.toMatch(/Mustermann/);
    });
  });

  describe("removeFiles", () => {
    const setup = async () => {
      await h.write(FOLDER_FILE, "a.txt", "a");
      await h.write(FOLDER_FILE, "sub/b.txt", "b");
      return buildOne();
    };

    it("deletes the given files", async () => {
      const { workspace, token, dir } = await setup();
      const result = await builder.removeFiles(workspace.root, token, ["a.txt", "sub\\b.txt", "missing.txt"]);
      expect(result.ok).toBe(true);
      expect(await walk(dir)).toEqual(["sub/"]);
    });

    it.each([
      ["../../ASSIGNMENT.md"],
      ["/etc/passwd"],
      ["sub/../../x"],
      [".."],
      ["."],
      [""],
      ["a\0b"],
    ])("refuses %p and deletes nothing", async (bad) => {
      const { workspace, token, dir } = await setup();
      const result = await builder.removeFiles(workspace.root, token, ["a.txt", bad]);
      expect(result.ok).toBe(false);
      expect(await walk(dir)).toEqual(["a.txt", "sub/", "sub/b.txt"]);
      expect(await fs.readFile(path.join(workspace.root, "ASSIGNMENT.md"), "utf8")).toBe("# Aufgabe\n");
    });

    it("refuses an invalid token and a root that is not a workspace", async () => {
      const { workspace } = await setup();
      expect((await builder.removeFiles(workspace.root, "../x", ["a.txt"])).ok).toBe(false);
      expect((await builder.removeFiles(workspace.root, "", ["a.txt"])).ok).toBe(false);
      expect((await builder.removeFiles(h.src, "abc", ["a.txt"])).ok).toBe(false);
    });

    it("fails for a directory", async () => {
      const { workspace, token } = await setup();
      const result = await builder.removeFiles(workspace.root, token, ["sub"]);
      expect(result.ok).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("removes a workspace", async () => {
      const { workspace } = await buildOne();
      expect((await builder.cleanup(workspace.root)).ok).toBe(true);
      await expect(fs.stat(workspace.root)).rejects.toThrow();
    });

    it("succeeds when the workspace is already gone", async () => {
      const { workspace } = await buildOne();
      await builder.cleanup(workspace.root);
      expect((await builder.cleanup(workspace.root)).ok).toBe(true);
    });

    it("refuses anything that is not a gradeflow- child of the tmp dir", async () => {
      const lookalike = path.join(h.src, "gradeflow-fake");
      await fs.mkdir(lookalike);
      await fs.writeFile(path.join(lookalike, "keep"), "x");
      const wrongName = await fs.mkdtemp(path.join(os.tmpdir(), "other-"));
      const nested = path.join(wrongName, "gradeflow-x");
      await fs.mkdir(nested);
      try {
        for (const target of [
          lookalike,
          wrongName,
          nested,
          h.src,
          os.tmpdir(),
          "/",
          "relative/gradeflow-x",
          "",
          path.join(os.tmpdir(), "gradeflow-"),
        ]) {
          expect((await builder.cleanup(target)).ok).toBe(false);
        }
        expect(await fs.readFile(path.join(lookalike, "keep"), "utf8")).toBe("x");
        expect((await fs.stat(nested)).isDirectory()).toBe(true);
      } finally {
        await fs.rm(wrongName, { recursive: true, force: true });
      }
    });

    it("accepts a tmp child given by its unresolved path", async () => {
      const { workspace } = await buildOne();
      const unresolved = path.join(os.tmpdir(), path.basename(workspace.root));
      expect((await builder.cleanup(unresolved)).ok).toBe(true);
      await expect(fs.stat(workspace.root)).rejects.toThrow();
    });
  });
});
