import { Result } from "../shared/Result";
import { DomainError } from "../../shared/errors";

export type AgentModel = "sonnet" | "opus";

export const DEFAULT_MAX_BUDGET_USD = 3;
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
export const DEFAULT_MODEL: AgentModel = "sonnet";

export interface AgentRunRequest {
  /** Real path (symlinks resolved) of the built workspace. */
  workspaceRoot: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  model: AgentModel;
  maxBudgetUsd: number;
  timeoutMs: number;
}

export interface AgentRunOutcome {
  structuredOutput: unknown;
  costUsd: number | null;
  durationMs: number;
  turns: number | null;
  permissionDenials: number;
}

export type AgentRunErrorCode =
  | "NOT_INSTALLED"
  | "NOT_LOGGED_IN"
  | "CANCELLED"
  | "TIMEOUT"
  | "BUDGET_EXCEEDED"
  | "NO_STRUCTURED_OUTPUT"
  | "AGENT_ERROR";

/** The message never contains paths, prompts or agent output: they hold student data. */
export class AgentRunError extends DomainError {
  constructor(
    readonly code: AgentRunErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type AgentProgress =
  | { kind: "started"; model: AgentModel }
  | { kind: "reading"; token: string }
  | { kind: "working"; turns: number }
  | { kind: "finished" };

export interface AgentRunner {
  run(
    request: AgentRunRequest,
    onProgress: (event: AgentProgress) => void,
    signal: AbortSignal,
  ): Promise<Result<AgentRunOutcome, AgentRunError>>;
}

const FILE_TOOLS = new Set(["Read", "Glob", "Grep"]);
const PATH_FIELDS = ["file_path", "path", "pattern", "glob"] as const;
const TOKEN = /^[A-Za-z0-9_-]+$/;

function slashed(value: string): string {
  return value.replace(/\\/g, "/");
}

function tokenOfPath(raw: string, root: string): string | null {
  let relative = slashed(raw);
  if (relative.startsWith(`${root}/`)) {
    relative = relative.slice(root.length + 1);
  } else if (relative.startsWith("/") || /^[A-Za-z]:\//.test(relative)) {
    return null;
  }
  while (relative.startsWith("./")) relative = relative.slice(2);
  const [first, token] = relative.split("/");
  if (first !== "handins" || token === undefined || !TOKEN.test(token)) {
    return null;
  }
  return token;
}

/** The hand-in token a Read, Glob or Grep call points into, or null. */
export function progressFromToolUse(
  toolName: string,
  input: unknown,
  workspaceRoot: string,
): string | null {
  if (!FILE_TOOLS.has(toolName)) return null;
  if (typeof input !== "object" || input === null) return null;
  const fields = input as Record<string, unknown>;
  const root = slashed(workspaceRoot).replace(/\/+$/, "");
  for (const field of PATH_FIELDS) {
    const value = fields[field];
    if (typeof value !== "string") continue;
    const token = tokenOfPath(value, root);
    if (token !== null) return token;
  }
  return null;
}
