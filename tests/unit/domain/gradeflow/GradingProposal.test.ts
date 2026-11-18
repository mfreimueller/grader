import { GradingType } from "../../../../src/domain/grade/GradingType";
import {
  GradingProposalContext,
  MAX_COMMENT_LENGTH,
  parseGradingProposal,
} from "../../../../src/domain/gradeflow/GradingProposal";
import { PseudonymMap } from "../../../../src/domain/gradeflow/PseudonymMap";

const aPseudonymMap = (ids: string[] = ["s-1", "s-2"]): PseudonymMap => {
  let seed = 3;
  const result = PseudonymMap.create(ids, (max) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % max;
  });
  if (!result.ok) throw result.error;
  return result.value;
};

const aContext = (
  overrides?: Partial<GradingProposalContext>,
): GradingProposalContext => ({
  gradingType: GradingType.TERTIARY,
  maxPoints: null,
  pseudonyms: aPseudonymMap(),
  ...overrides,
});

const tokenOf = (context: GradingProposalContext, id: string): string =>
  context.pseudonyms.tokenOf(id) ?? "";

const numeric = (maxPoints: number | null = 20): GradingProposalContext =>
  aContext({ gradingType: GradingType.NUMERIC, maxPoints });

const expectFailure = (
  raw: unknown,
  context: GradingProposalContext,
  fragment: string,
) => {
  const result = parseGradingProposal(raw, context);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.name).toBe("ValidationError");
    expect(result.error.message).toContain(fragment);
  }
};

describe("GradingProposal", () => {
  describe("parseGradingProposal envelope", () => {
    it.each([[null], ["text"], [[]], [42]])(
      "rejects a non-object (%p)",
      (raw) => {
        expectFailure(raw, aContext(), "object");
      },
    );

    it("rejects a wrong version", () => {
      expectFailure({ version: 2, results: [] }, aContext(), "version");
    });

    it("rejects results that are not an array", () => {
      expectFailure({ version: 1, results: {} }, aContext(), "results");
    });

    it("rejects a result entry that is not an object", () => {
      expectFailure({ version: 1, results: [null] }, aContext(), "results[0]");
    });

    it("rejects an unknown token", () => {
      expectFailure(
        {
          version: 1,
          results: [{ token: "nope", symbol: "PLUS", comment: "" }],
        },
        aContext(),
        "Unknown token",
      );
    });

    it("rejects a non-string token", () => {
      expectFailure(
        { version: 1, results: [{ token: 5, symbol: "PLUS", comment: "" }] },
        aContext(),
        "token",
      );
    });

    it("rejects a duplicate token", () => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      const entry = { token, symbol: "PLUS", comment: "" };
      expectFailure(
        { version: 1, results: [entry, entry] },
        context,
        "Duplicate",
      );
    });

    it("rejects a non-string comment", () => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      expectFailure(
        { version: 1, results: [{ token, symbol: "PLUS", comment: 5 }] },
        context,
        "comment",
      );
    });
  });

  describe("parseGradingProposal TERTIARY", () => {
    it("accepts valid symbols and reports missing students", () => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      const result = parseGradingProposal(
        {
          version: 1,
          results: [{ token, symbol: "PLUS_WELLE", comment: "good" }],
        },
        context,
      );
      expect(result).toEqual({
        ok: true,
        value: {
          proposals: [
            {
              studentId: "s-1",
              symbol: "PLUS_WELLE",
              score: null,
              comment: "good",
              flags: [],
            },
          ],
          missingStudentIds: ["s-2"],
        },
      });
    });

    it("normalises the symbol case and ignores a stray score", () => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      const result = parseGradingProposal(
        {
          version: 1,
          results: [{ token, symbol: "minus", score: 3, comment: "" }],
        },
        context,
      );
      expect(result.ok && result.value.proposals[0]).toMatchObject({
        symbol: "MINUS",
        score: null,
      });
    });

    it("rejects a missing or invalid symbol", () => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      expectFailure(
        { version: 1, results: [{ token, comment: "" }] },
        context,
        "symbol",
      );
      expectFailure(
        { version: 1, results: [{ token, symbol: "GREAT", comment: "" }] },
        context,
        "symbol",
      );
    });
  });

  describe("parseGradingProposal NUMERIC", () => {
    it("accepts scores including fractions and the bounds", () => {
      const context = numeric(20);
      const t1 = tokenOf(context, "s-1");
      const t2 = tokenOf(context, "s-2");
      const result = parseGradingProposal(
        {
          version: 1,
          results: [
            { token: t1, score: 17.5, comment: "a" },
            { token: t2, score: 0, comment: "b" },
          ],
        },
        context,
      );
      expect(
        result.ok && result.value.proposals.map((p) => [p.symbol, p.score]),
      ).toEqual([
        [null, 17.5],
        [null, 0],
      ]);
      expect(result.ok && result.value.missingStudentIds).toEqual([]);
    });

    it("accepts the maximum score", () => {
      const context = numeric(20);
      const token = tokenOf(context, "s-1");
      const result = parseGradingProposal(
        { version: 1, results: [{ token, score: 20, comment: "" }] },
        context,
      );
      expect(result.ok).toBe(true);
    });

    it.each([[undefined], ["5"], [NaN], [Infinity], [-0.5], [20.01]])(
      "rejects score %p",
      (score) => {
        const context = numeric(20);
        const token = tokenOf(context, "s-1");
        expectFailure(
          { version: 1, results: [{ token, score, comment: "" }] },
          context,
          "score",
        );
      },
    );

    it("rejects NUMERIC when maxPoints is null", () => {
      expectFailure({ version: 1, results: [] }, numeric(null), "maxPoints");
    });
  });

  describe("parseGradingProposal comments", () => {
    const run = (comment: string) => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      const other = tokenOf(context, "s-2");
      const result = parseGradingProposal(
        {
          version: 1,
          results: [
            {
              token,
              symbol: "PLUS",
              comment: comment
                .replace("{own}", token)
                .replace("{other}", other),
            },
          ],
        },
        context,
      );
      if (!result.ok) throw result.error;
      return result.value.proposals[0];
    };

    it("trims the comment", () => {
      expect(run("  fine \n")).toMatchObject({ comment: "fine", flags: [] });
    });

    it("removes tokens of any student, collapses spaces and flags the row", () => {
      expect(run("Work of {own} is better than {other} here")).toMatchObject({
        comment: "Work of is better than here",
        flags: ["TOKEN_IN_COMMENT"],
      });
    });

    it("removes tokens case-insensitively", () => {
      const context = aContext();
      const token = tokenOf(context, "s-1");
      const result = parseGradingProposal(
        {
          version: 1,
          results: [
            { token, symbol: "PLUS", comment: `see ${token.toUpperCase()}.` },
          ],
        },
        context,
      );
      expect(result.ok && result.value.proposals[0]).toMatchObject({
        comment: "see .",
        flags: ["TOKEN_IN_COMMENT"],
      });
    });

    it("keeps a comment of exactly the maximum length", () => {
      const comment = "a".repeat(MAX_COMMENT_LENGTH);
      expect(run(comment)).toMatchObject({ comment, flags: [] });
    });

    it("truncates an overlong comment and flags it", () => {
      const proposal = run("a".repeat(MAX_COMMENT_LENGTH + 50));
      expect(proposal?.comment).toHaveLength(MAX_COMMENT_LENGTH);
      expect(proposal?.flags).toEqual(["COMMENT_TRUNCATED"]);
    });

    it("does not cut a surrogate pair in half", () => {
      const proposal = run("a".repeat(MAX_COMMENT_LENGTH - 1) + "😀 tail");
      expect(proposal?.comment).toBe("a".repeat(MAX_COMMENT_LENGTH - 1));
      expect(proposal?.flags).toEqual(["COMMENT_TRUNCATED"]);
    });

    it("can set both flags", () => {
      const proposal = run("{own}" + "a".repeat(MAX_COMMENT_LENGTH + 1));
      expect(proposal?.flags).toEqual([
        "TOKEN_IN_COMMENT",
        "COMMENT_TRUNCATED",
      ]);
    });

    it("handles an empty pseudonym map", () => {
      const context = aContext({ pseudonyms: aPseudonymMap([]) });
      expect(
        parseGradingProposal({ version: 1, results: [] }, context),
      ).toEqual({
        ok: true,
        value: { proposals: [], missingStudentIds: [] },
      });
    });
  });
});
