import { GradingType } from "../grade/GradingType";
import { PARTICIPATION_SYMBOLS } from "../grade/ParticipationSymbol";
import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";
import { MAX_COMMENT_LENGTH } from "./GradingProposal";
import { SCRUB_PLACEHOLDER } from "./NameScrubber";

export interface OutputContract {
  gradingType: GradingType;
  maxPoints: number | null;
  tokens: string[];
}

type Rule = { kind: "tertiary" } | { kind: "numeric"; maxPoints: number };

function ruleOf(contract: OutputContract): Result<Rule> {
  if (contract.tokens.length === 0) {
    return Result.fail(new ValidationError("At least one token is required"));
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
    ].join("\n"),
  );
}

/** Plain JSON Schema for the SDK's structured output. */
export function outputJsonSchema(
  contract: OutputContract,
): Result<Record<string, unknown>> {
  const rule = ruleOf(contract);
  if (!rule.ok) return Result.fail(rule.error);

  const resultProperty =
    rule.value.kind === "tertiary"
      ? { symbol: { type: "string", enum: [...PARTICIPATION_SYMBOLS] } }
      : { score: { type: "number", minimum: 0, maximum: rule.value.maxPoints } };
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
          required: ["token", resultKey, "comment"],
          properties: {
            token: { type: "string", enum: [...contract.tokens] },
            ...resultProperty,
            comment: { type: "string", maxLength: MAX_COMMENT_LENGTH },
          },
        },
      },
    },
  });
}
