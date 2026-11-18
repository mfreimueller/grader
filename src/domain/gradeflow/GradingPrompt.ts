export interface GradingPromptInput {
  skillId: string;
  assignmentFile: string;
  solutionFile: string | null;
  tokenCount: number;
}

/** The user prompt of the single grading run. Deterministic; contains no student data. */
export function buildGradingPrompt(input: GradingPromptInput): string {
  const reads = [input.assignmentFile];
  if (input.solutionFile !== null) reads.push(input.solutionFile);
  reads.push("OUTPUT_SCHEMA.md");
  return [
    `Use the skill "${input.skillId}" to grade the hand-ins in this workspace.`,
    `Read ${reads.join(", ")}.`,
    `Grade every folder under handins/ (exactly ${input.tokenCount} folders).`,
    "Work only inside the current directory.",
    "Never mention tokens or names in comments.",
    "Write all comments in German and impersonal: no direct address (no du/Sie/dein/Ihr), short factual statements about the work.",
    "Return the result as your structured output.",
  ].join("\n");
}
