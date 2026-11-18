import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FsSkillCatalog } from "../../../../src/infrastructure/gradeflow/FsSkillCatalog";

const skillMd = (name: string, description = "Desc"): string =>
  `---\nname: ${name}\ndescription: ${description}\n---\n# Body\n`;

async function writeSkill(
  root: string,
  id: string,
  content: string | null,
): Promise<string> {
  const dir = path.join(root, id);
  await fs.mkdir(dir, { recursive: true });
  if (content !== null) await fs.writeFile(path.join(dir, "SKILL.md"), content);
  return dir;
}

describe("FsSkillCatalog", () => {
  let tmp: string;
  let bundled: string;
  let user: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "skillcat-"));
    bundled = path.join(tmp, "bundled");
    user = path.join(tmp, "user");
    await fs.mkdir(bundled);
    await fs.mkdir(user);
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("lists bundled and user skills sorted by name with their source", async () => {
    await writeSkill(bundled, "intermediate", skillMd("Mittel"));
    await writeSkill(bundled, "beginner", skillMd("Anfänger"));
    await writeSkill(user, "mine", skillMd("Zeta"));

    const { skills, invalid } = await new FsSkillCatalog(bundled, user).list();

    expect(skills.map((s) => [s.id, s.name, s.source])).toEqual([
      ["beginner", "Anfänger", "bundled"],
      ["intermediate", "Mittel", "bundled"],
      ["mine", "Zeta", "user"],
    ]);
    expect(invalid).toEqual([]);
  });

  it("lets the user's skill win over a bundled one with the same id", async () => {
    await writeSkill(bundled, "beginner", skillMd("Bundled"));
    const userDir = await writeSkill(user, "beginner", skillMd("Custom"));
    const catalog = new FsSkillCatalog(bundled, user);

    const { skills } = await catalog.list();

    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ name: "Custom", source: "user" });
    expect(await catalog.dirOf("beginner")).toBe(userDir);
  });

  it("returns the bundled directory for a bundled-only skill", async () => {
    const dir = await writeSkill(bundled, "beginner", skillMd("B"));
    expect(await new FsSkillCatalog(bundled, user).dirOf("beginner")).toBe(dir);
  });

  it("reports invalid skills with a reason and does not list them", async () => {
    await writeSkill(user, "no-frontmatter", "# nothing");
    await writeSkill(user, "Bad_Id", skillMd("X"));
    await writeSkill(user, "ok", skillMd("OK"));
    const catalog = new FsSkillCatalog(bundled, user);

    const { skills, invalid } = await catalog.list();

    expect(skills.map((s) => s.id)).toEqual(["ok"]);
    expect(invalid.map((i) => i.id).sort()).toEqual([
      "Bad_Id",
      "no-frontmatter",
    ]);
    expect(invalid.every((i) => i.reason.length > 0)).toBe(true);
    expect(await catalog.dirOf("no-frontmatter")).toBeNull();
    expect(await catalog.dirOf("Bad_Id")).toBeNull();
  });

  it("does not let an invalid user skill hide a valid bundled one", async () => {
    const dir = await writeSkill(bundled, "beginner", skillMd("Bundled"));
    await writeSkill(user, "beginner", "broken");
    const catalog = new FsSkillCatalog(bundled, user);

    const { skills, invalid } = await catalog.list();

    expect(skills.map((s) => s.source)).toEqual(["bundled"]);
    expect(invalid.map((i) => i.id)).toEqual(["beginner"]);
    expect(await catalog.dirOf("beginner")).toBe(dir);
  });

  it("ignores directories without SKILL.md and plain files", async () => {
    await writeSkill(user, "empty", null);
    await fs.writeFile(path.join(user, "readme.txt"), "x");
    const { skills, invalid } = await new FsSkillCatalog(bundled, user).list();
    expect(skills).toEqual([]);
    expect(invalid).toEqual([]);
  });

  it("reports an oversized SKILL.md as invalid and ignores a SKILL.md directory", async () => {
    await writeSkill(user, "huge", skillMd("Huge", "x".repeat(300 * 1024)));
    await fs.mkdir(path.join(user, "odd", "SKILL.md"), { recursive: true });
    const { skills, invalid } = await new FsSkillCatalog(bundled, user).list();
    expect(skills).toEqual([]);
    expect(invalid.map((i) => i.id)).toEqual(["huge"]);
  });

  it("treats missing directories as empty", async () => {
    const catalog = new FsSkillCatalog(
      path.join(tmp, "nope1"),
      path.join(tmp, "nope2"),
    );
    expect(await catalog.list()).toEqual({ skills: [], invalid: [] });
    expect(await catalog.dirOf("anything")).toBeNull();
  });

  it("rejects ids that could escape the skill directories", async () => {
    await writeSkill(tmp, "outside", skillMd("Out"));
    const catalog = new FsSkillCatalog(bundled, user);
    expect(await catalog.dirOf("../outside")).toBeNull();
    expect(await catalog.dirOf("")).toBeNull();
  });
});

describe("FsSkillCatalog with the bundled starter skills", () => {
  const bundledDir = path.join(
    __dirname,
    "../../../../assets/gradeflow/skills",
  );
  const expected: Array<[string, "opus" | null]> = [
    ["java-einsteiger", null],
    ["java-fortgeschritten", null],
    ["java-profi", "opus"],
    ["sql-mssql", null],
    ["sql-mysql", null],
    ["sql-postgresql", null],
  ];

  it("ships seven valid skills with the specified ids and models", async () => {
    const { skills, invalid } = await new FsSkillCatalog(
      bundledDir,
      path.join(bundledDir, "does-not-exist"),
    ).list();

    expect(invalid).toEqual([]);
    expect(skills.map((s) => s.id).sort()).toEqual(
      expected.map(([id]) => id).sort(),
    );
    for (const [id, model] of expected) {
      const skill = skills.find((s) => s.id === id);
      expect(skill?.model).toBe(model);
      expect(skill?.source).toBe("bundled");
    }
  });

  it("names the dialect in every SQL skill description", async () => {
    const { skills } = await new FsSkillCatalog(bundledDir, bundledDir).list();
    const description = (id: string): string =>
      skills.find((s) => s.id === id)?.description ?? "";
    expect(description("sql-mysql")).toContain("MySQL");
    expect(description("sql-mssql")).toMatch(/SQL Server|T-SQL/);
    expect(description("sql-postgresql")).toContain("PostgreSQL");
  });

  it("uses no direct address (du/Sie/dein/Ihr) anywhere in the skill texts", async () => {
    const direct = /\b(du|dein\w*|Sie|Ihr\w*)\b/;
    for (const [id] of expected) {
      const text = await fs.readFile(
        path.join(bundledDir, id, "SKILL.md"),
        "utf8",
      );
      expect({ id, hit: direct.exec(text)?.[0] ?? null }).toEqual({
        id,
        hit: null,
      });
    }
  });

  it("tells the agent to read the assignment and OUTPUT_SCHEMA.md and never to run code", async () => {
    for (const [id] of expected) {
      const text = await fs.readFile(
        path.join(bundledDir, id, "SKILL.md"),
        "utf8",
      );
      expect(text).toContain("OUTPUT_SCHEMA.md");
      expect(text).toContain("ASSIGNMENT");
      expect(text).toMatch(/nie ausgeführt/);
      for (const symbol of ["PLUS_WELLE", "WELLE", "MINUS_WELLE", "MINUS"])
        expect(text).toContain(symbol);
    }
  });
});
