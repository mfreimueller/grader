import { buildGradingPrompt } from "../../../../src/domain/gradeflow/GradingPrompt";

const FILE_ASSIGNMENT = { name: "ASSIGNMENT.md", kind: "file" } as const;
const FILE_SOLUTION = { name: "SOLUTION.pdf", kind: "file" } as const;
const DIR_ASSIGNMENT = { name: "assignment/", kind: "directory" } as const;
const DIR_SOLUTION = { name: "solution/", kind: "directory" } as const;
const STARTER_NOTE = "starter code the students were given";

describe("GradingPrompt", () => {
  describe("buildGradingPrompt", () => {
    const prompt = buildGradingPrompt({
      skillId: "grade-beginner",
      assignment: FILE_ASSIGNMENT,
      solution: FILE_SOLUTION,
      tokenCount: 30,
    });

    it("names the skill, the assignment, the solution and the output schema", () => {
      expect(prompt).toContain('skill "grade-beginner"');
      expect(prompt).toContain("Read ASSIGNMENT.md, SOLUTION.pdf, OUTPUT_SCHEMA.md.");
    });

    it("does not mention starter code when only files are given", () => {
      expect(prompt).not.toContain(STARTER_NOTE);
      expect(prompt).not.toContain("Read every file");
    });

    it("asks for exactly the given number of hand-in folders", () => {
      expect(prompt).toContain("exactly 30");
      expect(prompt).toContain("handins/");
    });

    it("confines the agent, forbids tokens and names in comments and asks for structured output", () => {
      expect(prompt).toMatch(/current directory/i);
      expect(prompt).toMatch(/never mention .*token.* name/i);
      expect(prompt).toMatch(/structured output/i);
    });

    it("asks for German, impersonal comments", () => {
      expect(prompt).toMatch(/comments in German/);
      expect(prompt).toMatch(/impersonal/);
      expect(prompt).toMatch(/no direct address/);
    });

    it("leaves out the solution when there is none", () => {
      const without = buildGradingPrompt({
        skillId: "s",
        assignment: FILE_ASSIGNMENT,
        solution: null,
        tokenCount: 1,
      });
      expect(without).not.toContain("SOLUTION");
      expect(without).toContain("exactly 1 ");
    });

    it("asks to read every file of an assignment folder and warns about starter code", () => {
      const result = buildGradingPrompt({
        skillId: "s",
        assignment: DIR_ASSIGNMENT,
        solution: FILE_SOLUTION,
        tokenCount: 2,
      });
      expect(result).toContain("Read SOLUTION.pdf, OUTPUT_SCHEMA.md.");
      expect(result).toContain("Read every file in assignment/ (the assignment).");
      expect(result).toContain(STARTER_NOTE);
    });

    it("asks to read every file of a solution folder", () => {
      const result = buildGradingPrompt({
        skillId: "s",
        assignment: FILE_ASSIGNMENT,
        solution: DIR_SOLUTION,
        tokenCount: 2,
      });
      expect(result).toContain("Read ASSIGNMENT.md, OUTPUT_SCHEMA.md.");
      expect(result).toContain("Read every file in solution/ (the sample solution).");
      expect(result).toContain(STARTER_NOTE);
    });

    it("mentions the starter code once when both are folders", () => {
      const result = buildGradingPrompt({
        skillId: "s",
        assignment: DIR_ASSIGNMENT,
        solution: DIR_SOLUTION,
        tokenCount: 2,
      });
      expect(result).toContain("Read OUTPUT_SCHEMA.md.");
      expect(result).toContain("assignment/ (the assignment)");
      expect(result).toContain("solution/ (the sample solution)");
      expect(result.split(STARTER_NOTE)).toHaveLength(2);
    });

    it("is deterministic", () => {
      const again = buildGradingPrompt({
        skillId: "grade-beginner",
        assignment: FILE_ASSIGNMENT,
        solution: FILE_SOLUTION,
        tokenCount: 30,
      });
      expect(again).toBe(prompt);
    });
  });
});
