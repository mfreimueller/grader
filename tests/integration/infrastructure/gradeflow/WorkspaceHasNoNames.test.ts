import fs from "node:fs/promises";
import path from "node:path";
import { FsHandinWorkspaceBuilder } from "../../../../src/infrastructure/gradeflow/FsHandinWorkspaceBuilder";
import { PseudonymMap } from "../../../../src/domain/gradeflow/PseudonymMap";
import { buildZip } from "./zipFixture";
import { Harness, walk } from "./workspaceHarness";

const STUDENTS = [
  { firstName: "Hannes", lastName: "Gruber" },
  { firstName: "Jörg", lastName: "Müller" },
];

// Every spelling the scrubber supports for these two students, as single words.
const FORBIDDEN =
  /hannes|gruber|jörg|joerg|jorg|müller|mueller|muller|jörg|müller/i;

const GRUBER = "Gruber Hannes_101_assignsubmission_file";
const GRUBER_TEXT = "Gruber Hannes_101_assignsubmission_onlinetext";
const MUELLER = "Müller Jörg_202_assignsubmission_file";

describe("Workspace content (Definition of Done: no student names)", () => {
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

  it("contains no student name in any file name or text, and reports what it did", async () => {
    // Names in contents, file names, directory names, archives and a .git directory.
    await h.write(GRUBER, "Gruber_Hannes_Uebung3.java", "// Hannes Gruber\n// GRUBER, HANNES\nclass A {}\n");
    await h.write(GRUBER, "hannes.gruber/notes.md", "Author: hannes_gruber (hannes.gruber@example.org)\n");
    await h.write(GRUBER, ".git/config", "[user]\n name = Hannes Gruber\n");
    await h.write(GRUBER, ".git/refs/heads/main", "Hannes Gruber\n");
    await h.write(
      GRUBER,
      "Abgabe Hannes Gruber.zip",
      buildZip([
        { name: "src/HannesGruber.java", data: "// by Hannes Gruber\n" },
        { name: "Gruber_Hannes/readme.txt", data: "Gruber Hannes\n" },
        { name: ".git/HEAD", data: "ref: Hannes Gruber\n" },
        { name: "../Hannes Gruber.txt", data: "evil" },
        { name: "pic.png", data: Buffer.from([0x89, 0x50, 0x00, 0x47]) },
      ]),
    );
    await h.write(GRUBER_TEXT, "onlinetext.html", "<p>Hannes Gruber</p>");
    await h.write(MUELLER, "Joerg_Mueller.txt", "Jörg Müller / Joerg Mueller / MÜLLER, JÖRG / Jorg Muller\n");
    await h.write(MUELLER, "Mueller Joerg.rar", "rar");
    await h.write(MUELLER, "node_modules/Müller/x.js", "x");

    const result = PseudonymMap.create(["g", "m"], (n) => Math.floor(Math.random() * n));
    if (!result.ok) throw result.error;
    const workspace = await h.build(
      builder,
      h.input(
        [
          h.handin("g", [GRUBER, GRUBER_TEXT], "101"),
          h.handin("m", [MUELLER], "202"),
        ],
        { pseudonyms: result.value, students: STUDENTS },
      ),
    );

    // The teacher's files are exempt (the skill fixture contains a name on purpose).
    const handins = path.join(workspace.root, "handins");
    const files = await walk(handins);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      expect(file).not.toMatch(FORBIDDEN);
      if (file.endsWith("/")) continue;
      const bytes = await fs.readFile(path.join(handins, file));
      if (!bytes.includes(0)) expect(bytes.toString("utf8")).not.toMatch(FORBIDDEN);
    }
    expect(JSON.stringify(workspace.report)).not.toMatch(FORBIDDEN);
    expect(JSON.stringify(workspace.report)).not.toMatch(/Gruber|Hannes/i);

    const gToken = result.value.tokenOf("g") ?? "";
    const mToken = result.value.tokenOf("m") ?? "";
    const kinds = (token: string): Record<string, string> =>
      Object.fromEntries(
        workspace.report.filter((e) => e.token === token).map((e) => [e.path, e.kind]),
      );
    expect(kinds(gToken)).toMatchObject({
      "STUDENT_Uebung3.java": "text",
      "STUDENT/notes.md": "text",
      ".git": "skipped",
      "Abgabe STUDENT/src/STUDENT.java": "text",
      "Abgabe STUDENT/STUDENT/readme.txt": "text",
      "Abgabe STUDENT/.git": "skipped",
      "Abgabe STUDENT/pic.png": "binary",
      "onlinetext.html": "text",
    });
    expect(Object.values(kinds(gToken))).toContain("archive-error");
    expect(kinds(mToken)).toMatchObject({
      "STUDENT.txt": "text",
      "STUDENT.rar": "unsupported-archive",
      node_modules: "skipped",
    });
    expect(await fs.readdir(handins)).toHaveLength(2);
  });
});
