import { GradingType } from "../grade/GradingType";
import { PARTICIPATION_SYMBOLS } from "../grade/ParticipationSymbol";
import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";
import { MAX_COMMENT_LENGTH } from "./CommentCleaning";
import { MAX_LINE_COMMENT_LENGTH, MAX_LINE_COMMENTS } from "./LineComments";
import { SCRUB_PLACEHOLDER } from "./NameScrubber";

export interface OutputContract {
  gradingType: GradingType;
  maxPoints: number | null;
  tokens: string[];
  /**
   * `jide`: symbol, overall comment and line comments, addressed to the student with "du" (the student reads them in
   * J;DE). Default `moodle`: impersonal comments, no line comments.
   */
  source?: "moodle" | "jide";
}

type Rule = { kind: "tertiary" } | { kind: "numeric"; maxPoints: number };

function ruleOf(contract: OutputContract): Result<Rule> {
  if (contract.tokens.length === 0) {
    return Result.fail(new ValidationError("At least one token is required"));
  }
  if (contract.source === "jide" && contract.gradingType !== GradingType.TERTIARY) {
    return Result.fail(new ValidationError("J;DE grades are symbols"));
  }
  if (contract.gradingType === GradingType.TERTIARY) {
    return Result.ok({ kind: "tertiary" });
  }
  const { maxPoints } = contract;
  if (maxPoints === null || !Number.isFinite(maxPoints) || maxPoints <= 0) {
    return Result.fail(
      new ValidationError("NUMERIC grading needs a positive maxPoints"),
    );
  }
  return Result.ok({ kind: "numeric", maxPoints });
}

/** Markdown for `OUTPUT_SCHEMA.md` in the workspace. */
export function renderOutputInstructions(
  contract: OutputContract,
): Result<string> {
  const rule = ruleOf(contract);
  if (!rule.ok) return Result.fail(rule.error);
  if (contract.source === "jide") return Result.ok(renderJideInstructions(contract.tokens));

  const example =
    rule.value.kind === "tertiary"
      ? `{ "token": "<token>", "symbol": "PLUS", "comment": "..." }`
      : `{ "token": "<token>", "score": 7.5, "comment": "..." }`;
  const valueRule =
    rule.value.kind === "tertiary"
      ? `\`symbol\` must be exactly one of: ${PARTICIPATION_SYMBOLS.map((s) => `\`${s}\``).join(", ")}.`
      : `\`score\` must be a number from 0 to ${rule.value.maxPoints} (fractions and decimals are allowed).`;

  return Result.ok(
    [
      "# Output format",
      "",
      "Return exactly one JSON object and nothing else:",
      "",
      "```json",
      `{ "version": 1, "results": [ ${example} ] }`,
      "```",
      "",
      "- `version` is always `1`.",
      `- ${valueRule}`,
      `- \`comment\` is a string of at most ${MAX_COMMENT_LENGTH} characters.`,
      "- `results` has exactly one entry for each of the following tokens, no more, no fewer, no duplicates:",
      "",
      ...contract.tokens.map((token) => `  - \`${token}\``),
      "",
      "## Comments",
      "",
      `A comment must never contain a token, a person's name or the placeholder \`${SCRUB_PLACEHOLDER}\` that stands in for names in the hand-ins. Write about the work, not the person.`,
      "",
      'Comments must be written in German (auf Deutsch) and impersonal (unpersönlich), i.e. keine direkte Anrede (kein "du", "Sie", "dein", "Ihr"), but short, factual statements about the work (kurze, sachliche Aussagen über die Arbeit), for example: "Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh."',
      "",
    ].join("\n"),
  );
}

function renderJideInstructions(tokens: string[]): string {
  return [
    "# Output format",
    "",
    "Return exactly one JSON object and nothing else:",
    "",
    "```json",
    `{ "version": 1, "results": [ { "token": "<token>", "symbol": "PLUS", "comment": "...", "lineComments": [ { "path": "Main.java", "line": 12, "text": "..." } ] } ] }`,
    "```",
    "",
    "- `version` is always `1`.",
    `- \`symbol\` must be exactly one of: ${PARTICIPATION_SYMBOLS.map((s) => `\`${s}\``).join(", ")}.`,
    `- \`comment\` is the overall comment, a string of at most ${MAX_COMMENT_LENGTH} characters.`,
    `- \`lineComments\` is a list (it may be empty) of at most ${MAX_LINE_COMMENTS} comments on single lines of the hand-in:`,
    "  - `path` is the path of a file of that hand-in relative to its folder `handins/<token>/`, written exactly as it appears there, with `/` as separator.",
    "  - `line` is the 1-based line number in that file. Only lines that exist; check the line by reading the file.",
    `  - \`text\` is the comment, at most ${MAX_LINE_COMMENT_LENGTH} characters.`,
    "- `results` has exactly one entry for each of the following tokens, no more, no fewer, no duplicates:",
    "",
    ...tokens.map((token) => `  - \`${token}\``),
    "",
    "## Comments",
    "",
    `A comment must never contain a token, a person's name or the placeholder \`${SCRUB_PLACEHOLDER}\` that stands in for names in the hand-ins. This applies to the overall comment and to every line comment.`,
    "",
    'These comments are read directly by the student who wrote the code, a beginner. Write them in German (auf Deutsch) and address the student directly with "du" ("dein", "deine"), never with "Sie". Be friendly, concrete and short, for example: "Hier fehlt ein Semikolon." or "Die Schleife endet einen Schritt zu früh: Du brauchst <= statt <." The overall comment is 1 to 4 sentences; a line comment is one or two.',
    "",
    "Put a line comment on the line it is about (an error, something that can be improved, or something done well). Do not write line comments that only repeat what the overall comment says.",
    "",
  ].join("\n");
}

/** Plain JSON Schema for the SDK's structured output. */
export function outputJsonSchema(
  contract: OutputContract,
): Result<Record<string, unknown>> {
  const rule = ruleOf(contract);
  if (!rule.ok) return Result.fail(rule.error);
  const jide = contract.source === "jide";

  const resultProperty =
    rule.value.kind === "tertiary"
      ? { symbol: { type: "string", enum: [...PARTICIPATION_SYMBOLS] } }
      : {
          score: { type: "number", minimum: 0, maximum: rule.value.maxPoints },
        };
  const resultKey = rule.value.kind === "tertiary" ? "symbol" : "score";

  return Result.ok({
    type: "object",
    additionalProperties: false,
    required: ["version", "results"],
    properties: {
      version: { const: 1 },
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["token", resultKey, "comment", ...(jide ? ["lineComments"] : [])],
          properties: {
            token: { type: "string", enum: [...contract.tokens] },
            ...resultProperty,
            comment: { type: "string", maxLength: MAX_COMMENT_LENGTH },
            ...(jide ? { lineComments: lineCommentsSchema() } : {}),
          },
        },
      },
    },
  });
}

function lineCommentsSchema(): Record<string, unknown> {
  return {
    type: "array",
    maxItems: MAX_LINE_COMMENTS,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["path", "line", "text"],
      properties: {
        path: { type: "string", minLength: 1, maxLength: 500 },
        line: { type: "integer", minimum: 1 },
        text: { type: "string", minLength: 1, maxLength: MAX_LINE_COMMENT_LENGTH },
      },
    },
  };
}
