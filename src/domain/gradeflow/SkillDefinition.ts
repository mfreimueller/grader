import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";
import { AgentModel } from "./AgentRunner";

export type SkillSource = "bundled" | "user";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  /** From the frontmatter `model:`; null means the default model. */
  model: AgentModel | null;
  source: SkillSource;
}

const SKILL_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KEY_VALUE = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/;

export const isValidSkillId = (id: string): boolean => SKILL_ID.test(id);

function unquote(value: string): string {
  const first = value[0];
  if (
    value.length >= 2 &&
    (first === '"' || first === "'") &&
    value.endsWith(first)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readFrontmatter(markdown: string): Map<string, string> | null {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trimEnd() !== "---") return null;
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trimEnd() === "---",
  );
  if (end < 0) return null;
  const values = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const match = KEY_VALUE.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1], unquote(match[2].trim()));
    }
  }
  return values;
}

function readModel(raw: string): AgentModel | null | undefined {
  const value = raw.toLowerCase();
  if (value === "") return null;
  if (value === "sonnet" || value === "opus") return value;
  return undefined;
}

/** The returned `source` is `user`; the catalog that knows where the file came from overrides it. */
export function parseSkillFile(
  id: string,
  markdown: string,
): Result<SkillDefinition> {
  if (!isValidSkillId(id)) {
    return Result.fail(new ValidationError("Invalid skill id"));
  }
  const frontmatter = readFrontmatter(markdown);
  if (frontmatter === null) {
    return Result.fail(
      new ValidationError("SKILL.md needs a frontmatter block (---)"),
    );
  }
  const name = frontmatter.get("name") ?? "";
  const description = frontmatter.get("description") ?? "";
  if (name === "" || description === "") {
    return Result.fail(
      new ValidationError("SKILL.md frontmatter needs name and description"),
    );
  }
  const model = readModel(frontmatter.get("model") ?? "");
  if (model === undefined) {
    return Result.fail(
      new ValidationError("SKILL.md model must be sonnet or opus"),
    );
  }
  return Result.ok({ id, name, description, model, source: "user" });
}
