import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  AgentRunError,
  AgentRunOutcome,
  AgentRunRequest,
  AgentRunner,
  AgentProgress,
} from "../../domain/gradeflow/AgentRunner";
import { Result } from "../../domain/shared/Result";

const COMMENT = "Testkommentar";
const LINE_COMMENT = "Testzeilenkommentar";

/** The first file below `dir` in name order, as a path relative to it with `/`; null when there is none. */
async function firstFile(dir: string, prefix = ""): Promise<string | null> {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    if (entry.isFile()) return `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      const found = await firstFile(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      if (found !== null) return found;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** The properties of one entry of `results` in the structured output schema, or null. */
function resultProperties(schema: Record<string, unknown>): Record<string, unknown> | null {
  const results = asRecord(asRecord(schema["properties"])?.["results"]);
  return asRecord(asRecord(asRecord(results?.["items"])?.["properties"]));
}

/**
 * Development and end-to-end stand-in for the Claude agent: it lists the hand-in folders of the workspace and
 * answers with a valid proposal, a middle grade for everybody. Never selected in a packaged app.
 */
export class FakeAgentRunner implements AgentRunner {
  async run(
    request: AgentRunRequest,
    onProgress: (event: AgentProgress) => void,
    signal: AbortSignal,
  ): Promise<Result<AgentRunOutcome, AgentRunError>> {
    if (signal.aborted) return fail("CANCELLED", "The run was cancelled");
    const properties = resultProperties(request.jsonSchema);
    const score = asRecord(properties?.["score"]);
    const isTertiary = properties?.["symbol"] !== undefined;
    const maximum = score?.["maximum"];
    if (!isTertiary && typeof maximum !== "number") {
      return fail("AGENT_ERROR", "The fake runner cannot read the output schema");
    }

    let tokens: string[];
    try {
      const entries = await readdir(path.join(request.workspaceRoot, "handins"), { withFileTypes: true });
      tokens = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    } catch {
      return fail("AGENT_ERROR", "The fake runner found no hand-ins");
    }

    onProgress({ kind: "started", model: request.model });
    for (const token of tokens) onProgress({ kind: "reading", token });
    onProgress({ kind: "working", turns: 3 });
    onProgress({ kind: "finished" });

    const value = isTertiary ? { symbol: "WELLE" } : { score: (maximum as number) / 2 };
    // A J;DE schema asks for line comments: one on the first line of the first file of each hand-in.
    const withLineComments = properties?.["lineComments"] !== undefined;
    const results = [];
    for (const token of tokens) {
      const result: Record<string, unknown> = { token, ...value, comment: COMMENT };
      if (withLineComments) {
        const file = await firstFile(path.join(request.workspaceRoot, "handins", token));
        result["lineComments"] = file === null ? [] : [{ path: file, line: 1, text: LINE_COMMENT }];
      }
      results.push(result);
    }
    return Result.ok({
      structuredOutput: { version: 1, results },
      costUsd: 0,
      durationMs: 0,
      turns: 3,
      permissionDenials: 0,
    });
  }
}

function fail(code: ConstructorParameters<typeof AgentRunError>[0], message: string): Result<never, AgentRunError> {
  return Result.fail(new AgentRunError(code, message));
}
