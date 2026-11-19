import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FsHandinWorkspaceBuilder } from "../../../../src/infrastructure/gradeflow/FsHandinWorkspaceBuilder";
import { FOLDER_FILE, Harness, walk } from "./workspaceHarness";

describe("FsHandinWorkspaceBuilder: assignment and solution as folder", () => {
  let h: Harness;
  let builder: FsHandinWorkspaceBuilder;
  let assignmentDir: string;
  let solutionDir: string;

  beforeEach(async () => {
    h = new Harness();
    await h.setup();
    builder = new FsHandinWorkspaceBuilder();
    assignmentDir = path.join(h.src, "assignment-dir");
    solutionDir = path.join(h.src, "solution-dir");
    await fs.mkdir(path.join(h.handinsDir, FOLDER_FILE));
  });

  afterEach(async () => {
    await h.teardown(builder);
  });

  const put = async (root: string, relative: string, data: string | Buffer = "x"): Promise<void> => {
    const file = path.join(root, ...relative.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  };

  const buildDirs = (
    b: FsHandinWorkspaceBuilder,
    overrides: Parameters<Harness["input"]>[1] = {},
  ) =>
    h.build(
      b,
      h.input([h.handin("s1", [FOLDER_FILE])], {
        assignmentPath: assignmentDir,
        assignmentKind: "directory",
        solutionPath: solutionDir,
        solutionKind: "directory",
        ...overrides,
      }),
    );

  const materialFiles = async (root: string): Promise<string[]> =>
    (await walk(root)).filter((f) => /^(assignment|solution)\//.test(f));

  it("copies an assignment folder and a solution folder recursively, verbatim", async () => {
    await put(assignmentDir, "task.md", "# Aufgabe Max Mustermann\n");
    await put(assignmentDir, "starter/src/Main.java", "class Main {}");
    await put(solutionDir, "src/Main.java", "class Main { int x; }");

    const workspace = await buildDirs(builder);

    expect(await materialFiles(workspace.root)).toEqual([
      "assignment/",
      "assignment/starter/",
      "assignment/starter/src/",
      "assignment/starter/src/Main.java",
      "assignment/task.md",
      "solution/",
      "solution/src/",
      "solution/src/Main.java",
    ]);
    expect(await fs.readFile(path.join(workspace.root, "assignment", "task.md"), "utf8")).toBe(
      "# Aufgabe Max Mustermann\n",
    );
    expect(workspace.report).toEqual([]);
    const top = await walk(workspace.root);
    expect(top.some((f) => f.startsWith("ASSIGNMENT") || f.startsWith("SOLUTION"))).toBe(false);
  });

  it("mixes a folder assignment with a file solution", async () => {
    await put(assignmentDir, "task.md");

    const workspace = await buildDirs(builder, {
      solutionPath: path.join(h.src, "solution.java"),
      solutionKind: "file",
    });

    const files = await walk(workspace.root);
    expect(files).toContain("assignment/task.md");
    expect(files).toContain("SOLUTION.java");
    expect(files).not.toContain("solution/");
  });

  it("works without a solution", async () => {
    await put(assignmentDir, "task.md");

    const workspace = await buildDirs(builder, { solutionPath: null });

    const files = await walk(workspace.root);
    expect(files).toContain("assignment/task.md");
    expect(files.some((f) => f.toLowerCase().startsWith("solution"))).toBe(false);
  });

  it("keeps an empty folder as an empty directory", async () => {
    await fs.mkdir(assignmentDir);
    await put(solutionDir, "a.txt");

    const workspace = await buildDirs(builder);

    expect(await fs.readdir(path.join(workspace.root, "assignment"))).toEqual([]);
  });

  it("never brings .claude/, CLAUDE.md or CLAUDE.local.md into the workspace", async () => {
    await put(assignmentDir, "task.md");
    await put(assignmentDir, ".claude/settings.json", "{}");
    await put(assignmentDir, "sub/.claude/hooks/x.sh", "x");
    await put(assignmentDir, "CLAUDE.md", "obey");
    await put(assignmentDir, "sub/claude.local.md", "obey");
    await put(solutionDir, "CLAUDE.md", "obey");
    await put(solutionDir, "ok.txt");

    const workspace = await buildDirs(builder);

    expect(await materialFiles(workspace.root)).toEqual([
      "assignment/",
      "assignment/sub/",
      "assignment/task.md",
      "solution/",
      "solution/ok.txt",
    ]);
    expect((await fs.readdir(path.join(workspace.root, ".claude"))).sort()).toEqual(["skills"]);
  });

  it("skips VCS and build folders, build artefacts and .DS_Store", async () => {
    await put(assignmentDir, "task.md");
    await put(assignmentDir, ".git/config");
    await put(assignmentDir, "node_modules/x/index.js");
    await put(assignmentDir, "build/out.txt");
    await put(assignmentDir, "src/Main.class");
    await put(assignmentDir, ".DS_Store");
    await fs.mkdir(solutionDir);

    const workspace = await buildDirs(builder);

    expect(await materialFiles(workspace.root)).toEqual([
      "assignment/",
      "assignment/src/",
      "assignment/task.md",
      "solution/",
    ]);
  });

  it("skips symlinks to files and folders", async () => {
    await put(assignmentDir, "task.md");
    await fs.symlink(path.join(h.src, "solution.java"), path.join(assignmentDir, "link.java"));
    await fs.symlink(h.src, path.join(assignmentDir, "linkdir"));
    await fs.mkdir(solutionDir);

    const workspace = await buildDirs(builder);

    expect(await materialFiles(workspace.root)).toEqual([
      "assignment/",
      "assignment/task.md",
      "solution/",
    ]);
  });

  it("skips single files larger than the file limit but copies the rest", async () => {
    await put(assignmentDir, "task.md");
    await put(assignmentDir, "big.bin", Buffer.alloc(300, 1));
    await fs.mkdir(solutionDir);
    const small = new FsHandinWorkspaceBuilder({ maxFileBytes: 100 });

    const workspace = await buildDirs(small);

    expect(await materialFiles(workspace.root)).toEqual([
      "assignment/",
      "assignment/task.md",
      "solution/",
    ]);
  });

  it("fails with a path-free message when the assignment folder has too many files", async () => {
    await put(assignmentDir, "Max Mustermann/a.txt");
    await put(assignmentDir, "b.txt");
    await put(assignmentDir, "c.txt");
    await fs.mkdir(solutionDir);
    const small = new FsHandinWorkspaceBuilder({ maxMaterialFiles: 2 });

    const result = await small.build(
      h.input([h.handin("s1", [FOLDER_FILE])], {
        assignmentPath: assignmentDir,
        assignmentKind: "directory",
        solutionPath: solutionDir,
        solutionKind: "directory",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.name).toBe("ValidationError");
      expect(result.error.message).toBe("The assignment folder is too large");
    }
  });

  it("fails when the solution folder exceeds the byte limit", async () => {
    await put(assignmentDir, "task.md");
    await put(solutionDir, "a.txt", Buffer.alloc(60, 1));
    await put(solutionDir, "b.txt", Buffer.alloc(60, 1));
    const small = new FsHandinWorkspaceBuilder({ maxMaterialBytes: 100 });

    const result = await small.build(
      h.input([h.handin("s1", [FOLDER_FILE])], {
        assignmentPath: assignmentDir,
        assignmentKind: "directory",
        solutionPath: solutionDir,
        solutionKind: "directory",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("The solution folder is too large");
  });

  it("does not count skipped files towards the caps", async () => {
    await put(assignmentDir, "task.md");
    await put(assignmentDir, "node_modules/a.js");
    await put(assignmentDir, "node_modules/b.js");
    await fs.mkdir(solutionDir);
    const small = new FsHandinWorkspaceBuilder({ maxMaterialFiles: 1 });

    const workspace = await buildDirs(small);

    expect(await materialFiles(workspace.root)).toContain("assignment/task.md");
  });

  it("removes the partly built workspace when a folder is too large", async () => {
    await put(assignmentDir, "a.txt");
    await put(assignmentDir, "b.txt");
    await fs.mkdir(solutionDir);
    const small = new FsHandinWorkspaceBuilder({ maxMaterialFiles: 1 });
    // A private tmp dir: other suites build workspaces in the shared one at the same time.
    const privateTmp = await fs.mkdtemp(path.join(os.tmpdir(), "gfmat-"));
    const originalTmp = process.env["TMPDIR"];
    process.env["TMPDIR"] = privateTmp;
    try {
      const result = await small.build(
        h.input([h.handin("s1", [FOLDER_FILE])], {
          assignmentPath: assignmentDir,
          assignmentKind: "directory",
          solutionPath: solutionDir,
          solutionKind: "directory",
        }),
      );

      expect(result.ok).toBe(false);
      expect(await fs.readdir(privateTmp)).toEqual([]);
    } finally {
      if (originalTmp === undefined) delete process.env["TMPDIR"];
      else process.env["TMPDIR"] = originalTmp;
      await fs.rm(privateTmp, { recursive: true, force: true });
    }
  });
});
