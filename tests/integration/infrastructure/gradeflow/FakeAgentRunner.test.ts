import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AgentProgress,
  AgentRunRequest,
} from "../../../../src/domain/gradeflow/AgentRunner";
import { FakeAgentRunner } from "../../../../src/infrastructure/gradeflow/FakeAgentRunner";
import { outputJsonSchema } from "../../../../src/domain/gradeflow/OutputInstructions";
import { GradingType } from "../../../../src/domain/grade/GradingType";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "fake-runner-"));
  fs.mkdirSync(path.join(root, "handins", "aaaa1111"), { recursive: true });
  fs.mkdirSync(path.join(root, "handins", "bbbb2222"), { recursive: true });
  fs.writeFileSync(path.join(root, "handins", "stray-file.txt"), "not a hand-in");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const request = (gradingType: GradingType, maxPoints: number | null): AgentRunRequest => {
  const schema = outputJsonSchema({ gradingType, maxPoints, tokens: ["aaaa1111", "bbbb2222"] });
  if (!schema.ok) throw schema.error;
  return {
    workspaceRoot: root,
    prompt: "grade",
    jsonSchema: schema.value,
    model: "sonnet",
    maxBudgetUsd: 1,
    timeoutMs: 1000,
  };
};

describe("FakeAgentRunner", () => {
  describe("run for a J;DE schema", () => {
    it("adds a line comment on the first line of the first file of each hand-in", async () => {
      fs.mkdirSync(path.join(root, "handins", "aaaa1111", "src"), { recursive: true });
      fs.writeFileSync(path.join(root, "handins", "aaaa1111", "src", "B.java"), "x\n");
      fs.writeFileSync(path.join(root, "handins", "aaaa1111", "A.java"), "x\n");
      const schema = outputJsonSchema({
        gradingType: GradingType.TERTIARY,
        maxPoints: null,
        tokens: ["aaaa1111", "bbbb2222"],
        source: "jide",
      });
      if (!schema.ok) throw schema.error;

      const outcome = await new FakeAgentRunner().run(
        { ...request(GradingType.TERTIARY, null), jsonSchema: schema.value },
        () => {},
        new AbortController().signal,
      );

      expect(outcome.ok && outcome.value.structuredOutput).toEqual({
        version: 1,
        results: [
          { token: "aaaa1111", symbol: "WELLE", comment: "Testkommentar", lineComments: [{ path: "A.java", line: 1, text: "Testzeilenkommentar" }] },
          { token: "bbbb2222", symbol: "WELLE", comment: "Testkommentar", lineComments: [] },
        ],
      });
    });
  });

  describe("run", () => {
    it("proposes WELLE for every hand-in folder of a TERTIARY assessment", async () => {
      const outcome = await new FakeAgentRunner().run(request(GradingType.TERTIARY, null), () => {}, new AbortController().signal);

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.structuredOutput).toEqual({
        version: 1,
        results: [
          { token: "aaaa1111", symbol: "WELLE", comment: "Testkommentar" },
          { token: "bbbb2222", symbol: "WELLE", comment: "Testkommentar" },
        ],
      });
      expect(outcome.value.costUsd).toBe(0);
    });

    it("proposes half of the maximum for a NUMERIC assessment", async () => {
      const outcome = await new FakeAgentRunner().run(request(GradingType.NUMERIC, 25), () => {}, new AbortController().signal);

      expect(outcome.ok && outcome.value.structuredOutput).toEqual({
        version: 1,
        results: [
          { token: "aaaa1111", score: 12.5, comment: "Testkommentar" },
          { token: "bbbb2222", score: 12.5, comment: "Testkommentar" },
        ],
      });
    });

    it("emits started, reading per hand-in, working and finished", async () => {
      const events: AgentProgress[] = [];

      await new FakeAgentRunner().run(request(GradingType.TERTIARY, null), (e) => events.push(e), new AbortController().signal);

      expect(events).toEqual([
        { kind: "started", model: "sonnet" },
        { kind: "reading", token: "aaaa1111" },
        { kind: "reading", token: "bbbb2222" },
        { kind: "working", turns: 3 },
        { kind: "finished" },
      ]);
    });

    it("fails with CANCELLED when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const outcome = await new FakeAgentRunner().run(request(GradingType.TERTIARY, null), () => {}, controller.signal);

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.code).toBe("CANCELLED");
    });

    it("fails with AGENT_ERROR when the workspace has no hand-ins folder", async () => {
      fs.rmSync(path.join(root, "handins"), { recursive: true });

      const outcome = await new FakeAgentRunner().run(request(GradingType.TERTIARY, null), () => {}, new AbortController().signal);

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error.code).toBe("AGENT_ERROR");
    });

    it("fails with AGENT_ERROR when the schema does not name a result field", async () => {
      const bad = { ...request(GradingType.TERTIARY, null), jsonSchema: { type: "object" } };

      const outcome = await new FakeAgentRunner().run(bad, () => {}, new AbortController().signal);

      expect(outcome.ok).toBe(false);
    });
  });
});
