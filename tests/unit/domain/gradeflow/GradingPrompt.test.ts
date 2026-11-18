import { buildGradingPrompt } from "../../../../src/domain/gradeflow/GradingPrompt";

describe("GradingPrompt", () => {
  describe("buildGradingPrompt", () => {
    const prompt = buildGradingPrompt({
      skillId: "grade-beginner",
      assignmentFile: "ASSIGNMENT.md",
      solutionFile: "SOLUTION.pdf",
      tokenCount: 30,
    });

    it("names the skill, the assignment, the solution and the output schema", () => {
      expect(prompt).toContain('skill "grade-beginner"');
      expect(prompt).toContain("ASSIGNMENT.md");
      expect(prompt).toContain("SOLUTION.pdf");
      expect(prompt).toContain("OUTPUT_SCHEMA.md");
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
        assignmentFile: "ASSIGNMENT.md",
        solutionFile: null,
        tokenCount: 1,
      });
      expect(without).not.toContain("SOLUTION");
      expect(without).toContain("exactly 1 ");
    });

    it("is deterministic", () => {
      const again = buildGradingPrompt({
        skillId: "grade-beginner",
        assignmentFile: "ASSIGNMENT.md",
        solutionFile: "SOLUTION.pdf",
        tokenCount: 30,
      });
      expect(again).toBe(prompt);
    });
  });
});
