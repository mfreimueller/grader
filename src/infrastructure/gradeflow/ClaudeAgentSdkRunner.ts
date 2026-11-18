import { realpath } from "node:fs/promises";
import path from "node:path";
import type {
  Options,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk" with { "resolution-mode": "import" };
import {
  AgentProgress,
  AgentRunError,
  AgentRunErrorCode,
  AgentRunOutcome,
  AgentRunRequest,
  AgentRunner,
  progressFromToolUse,
} from "../../domain/gradeflow/AgentRunner";
import { Result } from "../../domain/shared/Result";

export type QueryFn = (params: {
  prompt: string;
  options: Options;
}) => AsyncIterable<SDKMessage>;

export interface ClaudeAgentSdkRunnerOptions {
  /** Production: `async () => (await import("@anthropic-ai/claude-agent-sdk")).query`. */
  loadQuery: () => Promise<QueryFn>;
  /** Path of the Claude Code binary when the SDK cannot find it itself (packaged app), else null. */
  executablePath: string | null;
  /** Receives debug lines that contain numbers only (cost, duration, turns, denials). */
  debug?: (line: string) => void;
}

const MESSAGES: Record<AgentRunErrorCode, string> = {
  NOT_INSTALLED: "Claude Code is not available",
  NOT_LOGGED_IN: "Not signed in to Claude, please sign in again",
  CANCELLED: "The run was cancelled",
  TIMEOUT: "The run took too long",
  BUDGET_EXCEEDED: "The run exceeded its cost limit",
  NO_STRUCTURED_OUTPUT: "The agent returned no usable result",
  AGENT_ERROR: "The agent run failed",
};

const failure = (code: AgentRunErrorCode): Result<never, AgentRunError> =>
  Result.fail(new AgentRunError(code, MESSAGES[code]));

const NOT_LOGGED_IN = /not logged in|please run \/login/i;
const NOT_INSTALLED = /native binary not found|ENOENT|ERR_MODULE_NOT_FOUND/;

function classifyText(text: string): AgentRunErrorCode {
  if (NOT_LOGGED_IN.test(text)) return "NOT_LOGGED_IN";
  if (NOT_INSTALLED.test(text)) return "NOT_INSTALLED";
  return "AGENT_ERROR";
}

function classifyThrown(error: unknown): AgentRunErrorCode {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : "";
  return classifyText(`${code} ${message}`);
}

type ResultMessage = Extract<SDKMessage, { type: "result" }>;

function mapResult(result: ResultMessage): Result<AgentRunOutcome, AgentRunError> {
  if (result.subtype === "error_max_budget_usd") {
    return failure("BUDGET_EXCEEDED");
  }
  if (result.subtype === "error_max_structured_output_retries") {
    return failure("NO_STRUCTURED_OUTPUT");
  }
  if (result.subtype !== "success") {
    return failure(classifyText(result.errors.join(" ")));
  }
  if (result.is_error) return failure(classifyText(result.result));
  if (result.structured_output === undefined) {
    return failure("NO_STRUCTURED_OUTPUT");
  }
  return Result.ok({
    structuredOutput: result.structured_output,
    costUsd: result.total_cost_usd,
    durationMs: result.duration_ms,
    turns: result.num_turns,
    permissionDenials: result.permission_denials.length,
  });
}

export class ClaudeAgentSdkRunner implements AgentRunner {
  constructor(private readonly options: ClaudeAgentSdkRunnerOptions) {}

  async run(
    request: AgentRunRequest,
    onProgress: (event: AgentProgress) => void,
    signal: AbortSignal,
  ): Promise<Result<AgentRunOutcome, AgentRunError>> {
    if (!(await isOwnRealpath(request.workspaceRoot))) {
      return failure("AGENT_ERROR");
    }
    if (signal.aborted) return failure("CANCELLED");

    const controller = new AbortController();
    let timedOut = false;
    let cancelled = false;
    const onAbort = (): void => {
      cancelled = true;
      controller.abort();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs);

    try {
      return await this.drive(request, onProgress, controller, () =>
        timedOut ? "TIMEOUT" : cancelled ? "CANCELLED" : null,
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  }

  private async drive(
    request: AgentRunRequest,
    onProgress: (event: AgentProgress) => void,
    controller: AbortController,
    stopReason: () => "TIMEOUT" | "CANCELLED" | null,
  ): Promise<Result<AgentRunOutcome, AgentRunError>> {
    let thrown: unknown = null;
    let result: ResultMessage | null = null;
    let authFailed = false;
    let turns = 0;
    const seen = new Set<string>();

    try {
      const query = await this.options.loadQuery();
      onProgress({ kind: "started", model: request.model });
      for await (const message of query({
        prompt: request.prompt,
        options: this.sdkOptions(request, controller),
      })) {
        if (message.type === "result") {
          result = message;
        } else if (message.type === "assistant") {
          turns += 1;
          if (message.error === "authentication_failed") authFailed = true;
          onProgress({ kind: "working", turns });
          for (const block of message.message.content) {
            if (block.type !== "tool_use") continue;
            const token = progressFromToolUse(
              block.name,
              block.input,
              request.workspaceRoot,
            );
            if (token !== null && !seen.has(token)) {
              seen.add(token);
              onProgress({ kind: "reading", token });
            }
          }
        }
        if (stopReason() !== null) break;
      }
    } catch (error) {
      thrown = error;
    }

    const stopped = stopReason();
    if (stopped !== null) return failure(stopped);

    let outcome: Result<AgentRunOutcome, AgentRunError>;
    if (result !== null) {
      outcome = mapResult(result);
      this.options.debug?.(
        `cost=${result.total_cost_usd} durationMs=${result.duration_ms} turns=${result.num_turns} denials=${result.permission_denials.length}`,
      );
    } else if (authFailed) {
      outcome = failure("NOT_LOGGED_IN");
    } else {
      outcome = failure(thrown === null ? "AGENT_ERROR" : classifyThrown(thrown));
    }
    if (outcome.ok) onProgress({ kind: "finished" });
    return outcome;
  }

  private sdkOptions(
    request: AgentRunRequest,
    abortController: AbortController,
  ): Options {
    const scope = `/${request.workspaceRoot}/**`;
    return {
      cwd: request.workspaceRoot,
      model: request.model,
      tools: ["Read", "Glob", "Grep"],
      allowedTools: [`Read(${scope})`, `Glob(${scope})`, `Grep(${scope})`],
      permissionMode: "dontAsk",
      mcpServers: {},
      strictMcpConfig: true,
      settingSources: ["project"],
      persistSession: false,
      maxBudgetUsd: request.maxBudgetUsd,
      abortController,
      outputFormat: { type: "json_schema", schema: request.jsonSchema },
      ...(this.options.executablePath === null
        ? {}
        : { pathToClaudeCodeExecutable: this.options.executablePath }),
    };
  }
}

async function isOwnRealpath(root: string): Promise<boolean> {
  if (!path.isAbsolute(root)) return false;
  try {
    return (await realpath(root)) === root;
  } catch {
    return false;
  }
}
