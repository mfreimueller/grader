import { parseSkillFile } from "../../../../src/domain/gradeflow/SkillDefinition";

const file = (...lines: string[]): string => lines.join("\n");

describe("SkillDefinition", () => {
  describe("parseSkillFile", () => {
    it("reads name and description from the frontmatter", () => {
      const result = parseSkillFile(
        "beginner",
        file("---", "name: Beginner", "description: Grades gently", "---", "# Body"),
      );
      expect(result).toEqual({
        ok: true,
        value: {
          id: "beginner",
          name: "Beginner",
          description: "Grades gently",
          source: "user",
        },
      });
    });

    it("strips surrounding quotes, ignores other keys, accepts CRLF and a BOM", () => {
      const result = parseSkillFile(
        "a1",
        "﻿---\r\nlevel: 2\r\nname: 'Fine: grained'\r\ndescription: \"Strict\"\r\n---\r\ntext",
      );
      expect(result.ok && result.value).toMatchObject({
        name: "Fine: grained",
        description: "Strict",
      });
    });

    it("keeps a value that only starts with a quote", () => {
      const result = parseSkillFile(
        "a1",
        file("---", "name: 'odd", "description: x\"", "---"),
      );
      expect(result.ok && result.value).toMatchObject({
        name: "'odd",
        description: 'x"',
      });
    });

    it("ignores lines that are not key: value", () => {
      const result = parseSkillFile(
        "a1",
        file("---", "# comment", "", "name: N", "description: D", "---"),
      );
      expect(result.ok).toBe(true);
    });

    it.each([
      ["no frontmatter", "# Just text"],
      ["unterminated frontmatter", file("---", "name: N", "description: D")],
      ["missing name", file("---", "description: D", "---")],
      ["missing description", file("---", "name: N", "---")],
      ["empty name", file("---", "name:  ", "description: D", "---")],
    ])("fails for %s", (_label, markdown) => {
      expect(parseSkillFile("a1", markdown).ok).toBe(false);
    });

    it.each(["", "Upper", "-lead", "a_b", "a b", "../x", "a".repeat(65)])(
      "rejects the id %p",
      (id) => {
        const result = parseSkillFile(
          id,
          file("---", "name: N", "description: D", "---"),
        );
        expect(result.ok).toBe(false);
      },
    );

    it("accepts a 64 character id", () => {
      const result = parseSkillFile(
        "a".repeat(64),
        file("---", "name: N", "description: D", "---"),
      );
      expect(result.ok).toBe(true);
    });
  });
});
