import {
  outputJsonSchema,
  renderOutputInstructions,
} from "../../../../src/domain/gradeflow/OutputInstructions";
import { MAX_COMMENT_LENGTH } from "../../../../src/domain/gradeflow/GradingProposal";
import { GradingType } from "../../../../src/domain/grade/GradingType";

const tokens = ["k3f9a2zb", "p0q8x1mm"];

function ok<T>(
  result: { ok: true; value: T } | { ok: false; error: Error },
): T {
  if (!result.ok) throw result.error;
  return result.value;
}

describe("OutputInstructions", () => {
  describe("renderOutputInstructions", () => {
    it("describes the TERTIARY shape, the symbols and every token", () => {
      const text = ok(
        renderOutputInstructions({
          gradingType: GradingType.TERTIARY,
          maxPoints: null,
          tokens,
        }),
      );
      expect(text).toContain('"version": 1');
      expect(text).toContain('"symbol"');
      for (const symbol of [
        "PLUS",
        "PLUS_WELLE",
        "WELLE",
        "MINUS_WELLE",
        "MINUS",
      ])
        expect(text).toContain(symbol);
      expect(text).not.toContain('"score"');
      for (const token of tokens) expect(text).toContain(token);
    });

    it("requires German, impersonal comments for both grading types", () => {
      for (const contract of [
        { gradingType: GradingType.TERTIARY, maxPoints: null, tokens },
        { gradingType: GradingType.NUMERIC, maxPoints: 10, tokens },
      ]) {
        const text = ok(renderOutputInstructions(contract));
        expect(text).toContain("auf Deutsch");
        expect(text).toContain("unpersönlich");
        expect(text).toContain("keine direkte Anrede");
        expect(text).toContain(
          "Eingabeprüfung fehlt; Schleife endet einen Schritt zu früh.",
        );
      }
    });

    it("describes the NUMERIC shape and the point range", () => {
      const text = ok(
        renderOutputInstructions({
          gradingType: GradingType.NUMERIC,
          maxPoints: 20,
          tokens,
        }),
      );
      expect(text).toContain('"score"');
      expect(text).not.toContain('"symbol"');
      expect(text).toContain("0");
      expect(text).toContain("20");
      expect(text).toMatch(/fraction|decimal/i);
    });

    it("forbids tokens, names and the STUDENT placeholder in comments", () => {
      const text = ok(
        renderOutputInstructions({
          gradingType: GradingType.TERTIARY,
          maxPoints: null,
          tokens,
        }),
      );
      expect(text).toMatch(/comment/i);
      expect(text).toMatch(/never/i);
      expect(text).toContain("STUDENT");
      expect(text).toMatch(/name/i);
      expect(text).toContain(String(MAX_COMMENT_LENGTH));
    });

    it("fails for NUMERIC without maxPoints or with a non-positive one", () => {
      for (const maxPoints of [null, 0, -1, Number.NaN]) {
        const result = renderOutputInstructions({
          gradingType: GradingType.NUMERIC,
          maxPoints,
          tokens,
        });
        expect(result.ok).toBe(false);
      }
    });

    it("fails without tokens", () => {
      const result = renderOutputInstructions({
        gradingType: GradingType.TERTIARY,
        maxPoints: null,
        tokens: [],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("outputJsonSchema", () => {
    it("builds a strict TERTIARY schema", () => {
      const schema = ok(
        outputJsonSchema({
          gradingType: GradingType.TERTIARY,
          maxPoints: null,
          tokens,
        }),
      );
      expect(schema).toEqual({
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
              required: ["token", "symbol", "comment"],
              properties: {
                token: { type: "string", enum: tokens },
                symbol: {
                  type: "string",
                  enum: ["PLUS", "PLUS_WELLE", "WELLE", "MINUS_WELLE", "MINUS"],
                },
                comment: { type: "string", maxLength: MAX_COMMENT_LENGTH },
              },
            },
          },
        },
      });
    });

    it("builds a NUMERIC schema with a score range", () => {
      const schema = ok(
        outputJsonSchema({
          gradingType: GradingType.NUMERIC,
          maxPoints: 12.5,
          tokens,
        }),
      );
      const items = (
        (schema.properties as Record<string, unknown>).results as {
          items: { required: string[]; properties: Record<string, unknown> };
        }
      ).items;
      expect(items.required).toEqual(["token", "score", "comment"]);
      expect(items.properties.score).toEqual({
        type: "number",
        minimum: 0,
        maximum: 12.5,
      });
      expect(items.properties.symbol).toBeUndefined();
    });

    it("fails for NUMERIC without maxPoints and without tokens", () => {
      expect(
        outputJsonSchema({
          gradingType: GradingType.NUMERIC,
          maxPoints: null,
          tokens,
        }).ok,
      ).toBe(false);
      expect(
        outputJsonSchema({
          gradingType: GradingType.TERTIARY,
          maxPoints: null,
          tokens: [],
        }).ok,
      ).toBe(false);
    });
  });
});

describe("OutputInstructions for J;DE", () => {
  const contract = { gradingType: GradingType.TERTIARY, maxPoints: null, tokens, source: "jide" as const };

  it("describes symbol, overall comment and line comments for every token", () => {
    const text = ok(renderOutputInstructions(contract));
    expect(text).toContain('"lineComments"');
    expect(text).toContain("1-based");
    expect(text).toContain("handins/<token>/");
    for (const symbol of ["PLUS", "PLUS_WELLE", "WELLE", "MINUS_WELLE", "MINUS"]) expect(text).toContain(symbol);
    for (const token of tokens) expect(text).toContain(token);
  });

  it("asks for \"du\" and still forbids names, tokens and the placeholder", () => {
    const text = ok(renderOutputInstructions(contract));
    expect(text).toContain('address the student directly with "du"');
    expect(text).toContain("never with \"Sie\"");
    expect(text).toContain("must never contain a token, a person's name");
    expect(text).toContain("STUDENT");
    expect(text).not.toContain("unpersönlich");
  });

  it("leaves the Moodle instructions impersonal and without line comments", () => {
    const text = ok(renderOutputInstructions({ ...contract, source: "moodle" }));
    expect(text).toContain("unpersönlich");
    expect(text).not.toContain("lineComments");
  });

  it("refuses points: J;DE grades are symbols", () => {
    const result = renderOutputInstructions({ ...contract, gradingType: GradingType.NUMERIC, maxPoints: 10 });
    expect(result.ok).toBe(false);
    expect(outputJsonSchema({ ...contract, gradingType: GradingType.NUMERIC, maxPoints: 10 }).ok).toBe(false);
  });

  it("requires lineComments in the schema, within the limits", () => {
    const schema = ok(outputJsonSchema(contract)) as {
      properties: { results: { items: { required: string[]; properties: Record<string, { maxItems?: number; items?: { properties: Record<string, unknown>; required: string[] } }> } } };
    };
    const item = schema.properties.results.items;
    expect(item.required).toEqual(["token", "symbol", "comment", "lineComments"]);
    expect(item.properties.lineComments?.maxItems).toBe(200);
    expect(item.properties.lineComments?.items?.required).toEqual(["path", "line", "text"]);
    expect(item.properties.lineComments?.items?.properties.text).toMatchObject({ maxLength: 1000 });
    expect(item.properties.lineComments?.items?.properties.line).toMatchObject({ type: "integer", minimum: 1 });
  });

  it("keeps the Moodle schema free of lineComments", () => {
    const schema = ok(outputJsonSchema({ ...contract, source: "moodle" }));
    expect(JSON.stringify(schema)).not.toContain("lineComments");
  });
});
