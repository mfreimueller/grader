import { MaterialKind } from "./WorkspaceMaterial";

/** A teacher's material as it lies in the workspace: `name` is `ASSIGNMENT.md`, `solution/`, ... */
export interface PromptMaterial {
  name: string;
  kind: MaterialKind;
}

export interface GradingPromptInput {
  skillId: string;
  assignment: PromptMaterial;
  solution: PromptMaterial | null;
  tokenCount: number;
  /** `jide`: comments address the student with "du" and include line comments. Default `moodle`. */
  source?: "moodle" | "jide";
}

/** The user prompt of the single grading run. Deterministic; contains no student data. */
export function buildGradingPrompt(input: GradingPromptInput): string {
  const fileReads: string[] = [];
  const folderReads: string[] = [];
  const add = (material: PromptMaterial, label: string): void => {
    if (material.kind === "file") fileReads.push(material.name);
    else folderReads.push(`Read every file in ${material.name} (${label}).`);
  };
  add(input.assignment, "the assignment");
  if (input.solution !== null) add(input.solution, "the sample solution");
  fileReads.push("OUTPUT_SCHEMA.md");
  const lines = [
    `Use the skill "${input.skillId}" to grade the hand-ins in this workspace.`,
    `Read ${fileReads.join(", ")}.`,
    ...folderReads,
  ];
  if (folderReads.length > 0) {
    lines.push(
      "A folder may contain starter code the students were given; only changes to it are their own work.",
    );
  }
  lines.push(
    `Grade every folder under handins/ (exactly ${input.tokenCount} folders).`,
    "Work only inside the current directory.",
    "Never mention tokens or names in comments.",
    ...(input.source === "jide"
      ? [
          'Write all comments in German and address the student directly with "du" (never "Sie"). Add line comments on the lines they are about, as OUTPUT_SCHEMA.md describes.',
        ]
      : [
          "Write all comments in German and impersonal: no direct address (no du/Sie/dein/Ihr), short factual statements about the work.",
        ]),
    "Return the result as your structured output.",
  );
  return lines.join("\n");
}
