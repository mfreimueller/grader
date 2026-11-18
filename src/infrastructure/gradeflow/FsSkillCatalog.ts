import fs from "node:fs/promises";
import path from "node:path";
import {
  InvalidSkill,
  SkillCatalog,
  SkillListing,
} from "../../domain/gradeflow/SkillCatalog";
import {
  isValidSkillId,
  parseSkillFile,
  SkillDefinition,
  SkillSource,
} from "../../domain/gradeflow/SkillDefinition";

const SKILL_FILE = "SKILL.md";
const MAX_SKILL_FILE_BYTES = 256 * 1024;

type Scanned =
  | { status: "valid"; skill: SkillDefinition; dir: string }
  | { status: "invalid"; invalid: InvalidSkill };

async function readSkillFile(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_SKILL_FILE_BYTES) return "";
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function scanRoot(root: string, source: SkillSource): Promise<Scanned[]> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const scanned: Scanned[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    const markdown = await readSkillFile(path.join(dir, SKILL_FILE));
    if (markdown === null) continue; // not a skill directory
    const parsed = parseSkillFile(entry.name, markdown);
    scanned.push(
      parsed.ok
        ? { status: "valid", skill: { ...parsed.value, source }, dir }
        : {
            status: "invalid",
            invalid: { id: entry.name, reason: parsed.error.message },
          },
    );
  }
  return scanned;
}

export class FsSkillCatalog implements SkillCatalog {
  constructor(
    private readonly bundledDir: string,
    private readonly userDir: string,
  ) {}

  private async scanAll(): Promise<Scanned[]> {
    // The user's skills come first so they win when ids collide.
    return [
      ...(await scanRoot(this.userDir, "user")),
      ...(await scanRoot(this.bundledDir, "bundled")),
    ];
  }

  async list(): Promise<SkillListing> {
    const skills = new Map<string, SkillDefinition>();
    const invalid: InvalidSkill[] = [];
    for (const scanned of await this.scanAll()) {
      if (scanned.status === "invalid") invalid.push(scanned.invalid);
      else if (!skills.has(scanned.skill.id))
        skills.set(scanned.skill.id, scanned.skill);
    }
    return {
      skills: [...skills.values()].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      ),
      invalid,
    };
  }

  async dirOf(id: string): Promise<string | null> {
    if (!isValidSkillId(id)) return null;
    for (const scanned of await this.scanAll()) {
      if (scanned.status === "valid" && scanned.skill.id === id)
        return scanned.dir;
    }
    return null;
  }
}
