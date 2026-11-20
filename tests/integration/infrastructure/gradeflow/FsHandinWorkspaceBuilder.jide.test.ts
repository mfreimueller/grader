import fs from "node:fs/promises";
import path from "node:path";
import type { BuildJideWorkspaceInput, BuiltJideWorkspace } from "../../../../src/domain/gradeflow/JideWorkspaceBuilder";
import { FsHandinWorkspaceBuilder } from "../../../../src/infrastructure/gradeflow/FsHandinWorkspaceBuilder";
import { Harness, STUDENTS, walk } from "./workspaceHarness";
import { buildZip } from "./zipFixture";

const PACKAGE = buildZip([
  { name: "exercise.yaml", data: "id: summe\ntitle: Summe\n" },
  { name: "aufgabe.md", data: "# Summe\nBerechne die Summe.\n" },
  { name: "files/Summe.java", data: "class Summe {\n}\n" },
  { name: "tests.yaml", data: "tests: []\n" },
  { name: ".claude/settings.json", data: "{}" },
  { name: "CLAUDE.md", data: "do bad things" },
  { name: "files/build/x.class", data: "x" },
]);

describe("FsHandinWorkspaceBuilder: J;DE runs", () => {
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

  const input = (patch: Partial<BuildJideWorkspaceInput> = {}): BuildJideWorkspaceInput => ({
    packageZip: PACKAGE,
    handins: [
      { studentId: "s1", files: [{ path: "Summe.java", content: "class Summe {\n  // Max Mustermann\n  int x;\n}\n" }] },
      { studentId: "s2", files: [{ path: "src/Util.java", content: "class Util {}\n" }] },
    ],
    pseudonyms: h.map,
    students: STUDENTS.map(({ firstName, lastName }) => ({ firstName, lastName })),
    outputInstructions: "# Output\n",
    skill: { id: "java-jide", dir: path.join(h.src, "skill") },
    ...patch,
  });

  const build = async (patch: Partial<BuildJideWorkspaceInput> = {}): Promise<BuiltJideWorkspace> => {
    const result = await builder.buildJide(input(patch));
    if (!result.ok) throw result.error;
    h.built.push(result.value.root);
    return result.value;
  };

  it("lays out the package as assignment/, the hand-ins by token, and the skill", async () => {
    const built = await build();
    const files = await walk(built.root);
    const [t1, t2] = [h.tokenOf("s1"), h.tokenOf("s2")];
    expect(files).toEqual(
      expect.arrayContaining([
        "OUTPUT_SCHEMA.md",
        ".claude/skills/java-jide/SKILL.md",
        "assignment/aufgabe.md",
        "assignment/exercise.yaml",
        "assignment/files/Summe.java",
        "assignment/tests.yaml",
        `handins/${t1}/Summe.java`,
        `handins/${t2}/src/Util.java`,
      ]),
    );
  });

  it("drops what must never reach the agent from the package", async () => {
    const files = await walk((await build()).root);
    expect(files.filter((f) => f.startsWith("assignment/")).join()).not.toMatch(/\.claude|CLAUDE|build/);
  });

  it("scrubs names in hand-in files and reports it", async () => {
    const built = await build();
    const text = await fs.readFile(path.join(built.root, "handins", h.tokenOf("s1"), "Summe.java"), "utf8");
    expect(text).toContain("// STUDENT");
    expect(text).not.toContain("Mustermann");
    expect(built.report).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: h.tokenOf("s1"), path: "Summe.java", kind: "text", replacements: 1 })]),
    );
  });

  it("reports the files with their line count and original path", async () => {
    const built = await build();
    expect(built.files).toEqual(
      expect.arrayContaining([
        { token: h.tokenOf("s1"), path: "Summe.java", originalPath: "Summe.java", lineCount: 4 },
        { token: h.tokenOf("s2"), path: "src/Util.java", originalPath: "src/Util.java", lineCount: 1 },
      ]),
    );
  });

  it("keeps the original path when scrubbing changes the file name", async () => {
    const built = await build({
      handins: [{ studentId: "s1", files: [{ path: "MaxMustermann.java", content: "class A {}\n" }] }],
    });
    expect(built.files).toEqual([
      { token: h.tokenOf("s1"), path: "STUDENT.java", originalPath: "MaxMustermann.java", lineCount: 1 },
    ]);
  });

  it("does not trust line comments when scrubbing changed the number of lines", async () => {
    const built = await build({
      handins: [{ studentId: "s1", files: [{ path: "A.java", content: "// Max\nMustermann\nx\n" }] }],
    });
    expect(built.files[0]?.lineCount).toBe(0);
  });

  it("skips files the rules exclude and reports them", async () => {
    const built = await build({
      handins: [
        {
          studentId: "s1",
          files: [
            { path: "build/Out.class", content: "x" },
            { path: "../evil.java", content: "x" },
            { path: "A.java", content: "a\n" },
          ],
        },
      ],
    });
    expect(built.files.map((f) => f.originalPath)).toEqual(["A.java"]);
    expect(built.report.map((r) => `${r.path}:${r.kind}`)).toEqual(
      expect.arrayContaining(["build/Out.class:skipped", "../evil.java:archive-error"]),
    );
    const files = await walk(built.root);
    expect(files.some((f) => f.includes("evil"))).toBe(false);
  });

  it("copes with backslashes and a leading ./ in paths", async () => {
    const built = await build({
      handins: [{ studentId: "s1", files: [{ path: ".\\src\\A.java", content: "a\n" }] }],
    });
    expect(built.files).toEqual([{ token: h.tokenOf("s1"), path: "src/A.java", originalPath: ".\\src\\A.java", lineCount: 1 }]);
  });

  it("reports an oversize file as too large", async () => {
    const small = new FsHandinWorkspaceBuilder({ maxFileBytes: 10 });
    const result = await small.buildJide(
      input({ handins: [{ studentId: "s1", files: [{ path: "Big.java", content: "x".repeat(50) }] }] }),
    );
    if (!result.ok) throw result.error;
    h.built.push(result.value.root);
    expect(result.value.report).toEqual([expect.objectContaining({ path: "Big.java", kind: "too-large" })]);
    expect(result.value.files).toEqual([]);
  });

  it("fails without leaving a workspace when the package is not a zip", async () => {
    const before = (await fs.readdir(path.dirname(h.src))).filter((n) => n.startsWith("gradeflow-")).length;
    const result = await builder.buildJide(input({ packageZip: new Uint8Array([1, 2, 3]) }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe("Das Aufgabenpaket ist ungültig.");
    const after = (await fs.readdir(path.dirname(h.src))).filter((n) => n.startsWith("gradeflow-")).length;
    expect(after).toBe(before);
  });

  it("can exclude a file afterwards and clean up", async () => {
    const built = await build();
    const removed = await builder.removeFiles(built.root, h.tokenOf("s1"), ["Summe.java"]);
    expect(removed.ok).toBe(true);
    expect(await walk(built.root)).not.toContain(`handins/${h.tokenOf("s1")}/Summe.java`);
  });
});
