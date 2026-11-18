import {
  AgentRunError,
  DEFAULT_MAX_BUDGET_USD,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  progressFromToolUse,
} from "../../../../src/domain/gradeflow/AgentRunner";
import { DomainError } from "../../../../src/shared/errors";

const ROOT = "/private/tmp/gfws-abc";

describe("AgentRunner", () => {
  it("has the agreed defaults", () => {
    expect(DEFAULT_MAX_BUDGET_USD).toBe(3);
    expect(DEFAULT_TIMEOUT_MS).toBe(15 * 60 * 1000);
    expect(DEFAULT_MODEL).toBe("sonnet");
  });

  describe("AgentRunError", () => {
    it("is a DomainError that carries its code", () => {
      const error = new AgentRunError("TIMEOUT", "The run took too long");
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe("TIMEOUT");
      expect(error.message).toBe("The run took too long");
    });
  });

  describe("progressFromToolUse", () => {
    it.each([
      ["Read", { file_path: `${ROOT}/handins/k3x9q2ab/main.py` }, "k3x9q2ab"],
      ["Read", { file_path: "handins/k3x9q2ab/main.py" }, "k3x9q2ab"],
      ["Read", { file_path: "./handins/k3x9q2ab/main.py" }, "k3x9q2ab"],
      ["Glob", { pattern: "handins/k3x9q2ab/**/*.py" }, "k3x9q2ab"],
      ["Glob", { pattern: "**/*.py", path: `${ROOT}/handins/k3x9q2ab` }, "k3x9q2ab"],
      ["Glob", { pattern: `${ROOT}/handins/k3x9q2ab/*.py` }, "k3x9q2ab"],
      ["Grep", { pattern: "def", path: "handins/k3x9q2ab" }, "k3x9q2ab"],
      ["Grep", { pattern: "def", glob: "handins/k3x9q2ab/*.py" }, "k3x9q2ab"],
      ["Read", { file_path: `${ROOT}\\handins\\k3x9q2ab\\main.py` }, "k3x9q2ab"],
    ])("finds the token for %s %j", (tool, input, token) => {
      expect(progressFromToolUse(tool, input, ROOT)).toBe(token);
    });

    it.each([
      ["a tool that is not Read, Glob or Grep", "Write", { file_path: "handins/k3x9q2ab/a.py" }],
      ["a path outside the workspace", "Read", { file_path: "/etc/handins/k3x9q2ab/a.py" }],
      ["a path that is not below handins", "Read", { file_path: "ASSIGNMENT.md" }],
      ["handins itself", "Glob", { pattern: "handins/*/main.py" }],
      ["a wildcard token", "Glob", { pattern: "handins/k3*/main.py" }],
      ["a bare handins folder", "Glob", { pattern: "handins" }],
      ["input that is not an object", "Read", "handins/k3x9q2ab/a.py"],
      ["null input", "Read", null],
      ["non-string fields", "Read", { file_path: 5, path: null }],
    ])("finds nothing for %s", (_label, tool, input) => {
      expect(progressFromToolUse(tool, input, ROOT)).toBeNull();
    });

    it("accepts a token that is the last path segment", () => {
      expect(progressFromToolUse("Glob", { pattern: "x", path: "handins/k3x9q2ab" }, ROOT)).toBe("k3x9q2ab");
    });

    it("takes the first field that points into a hand-in", () => {
      expect(
        progressFromToolUse("Grep", { pattern: "def", path: "ASSIGNMENT.md", glob: "handins/zzzz1111/*" }, ROOT),
      ).toBe("zzzz1111");
    });
  });
});
