import type { QueryFn } from "./ClaudeAgentSdkRunner";

/**
 * Production `loadQuery`. The SDK is an ES module, so it is loaded with a real dynamic import
 * (tsconfig.main.json uses Node16 modules and keeps `import()` in the CommonJS output).
 * Jest cannot load it; tests inject a fake QueryFn instead.
 */
export const loadClaudeAgentSdkQuery = async (): Promise<QueryFn> =>
  (await import("@anthropic-ai/claude-agent-sdk")).query;
