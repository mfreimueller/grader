import { SkillDefinition } from "./SkillDefinition";

export interface InvalidSkill {
  id: string;
  reason: string;
}

export interface SkillListing {
  skills: SkillDefinition[];
  invalid: InvalidSkill[];
}

export interface SkillCatalog {
  /** Valid skills sorted by name; a user skill replaces a bundled one with the same id. */
  list(): Promise<SkillListing>;
  /** Directory to copy into the workspace, or null for an unknown or invalid skill. */
  dirOf(id: string): Promise<string | null>;
}
