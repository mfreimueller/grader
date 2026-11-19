import { workspaceMaterialName } from "../../../../src/domain/gradeflow/WorkspaceMaterial";

describe("WorkspaceMaterial", () => {
  describe("workspaceMaterialName", () => {
    it("keeps the extension of an assignment file", () => {
      expect(workspaceMaterialName("assignment", "file", ".md")).toBe("ASSIGNMENT.md");
    });

    it("keeps the extension of a solution file", () => {
      expect(workspaceMaterialName("solution", "file", ".pdf")).toBe("SOLUTION.pdf");
    });

    it("handles a file without extension", () => {
      expect(workspaceMaterialName("solution", "file", "")).toBe("SOLUTION");
    });

    it("names a directory with a trailing slash and ignores the extension", () => {
      expect(workspaceMaterialName("assignment", "directory", ".md")).toBe("assignment/");
      expect(workspaceMaterialName("solution", "directory", "")).toBe("solution/");
    });
  });
});
