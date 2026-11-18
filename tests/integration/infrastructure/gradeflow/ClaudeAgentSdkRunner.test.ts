import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AgentProgress,
  AgentRunRequest,
} from "../../../../src/domain/gradeflow/AgentRunner";
import {
  ClaudeAgentSdkRunner,
  QueryFn,
} from "../../../../src/infrastructure/gradeflow/ClaudeAgentSdkRunner";

type Message = QueryFn extends (...args: never[]) => AsyncIterable<infer M>
  ? M
  : never;
type Params = Parameters<QueryFn>[0];

const msg = (value: Record<string, unknown>): Message =>
  value as unknown as Message;

const assistant = (
  blocks: unknown[],
  extra: Record<string, unknown> = {},
): Message => msg({ type: "assistant", message: { content: blocks }, ...extra });

const toolUse = (name: string, input: unknown): unknown => ({
  type: "tool_use",
  name,
  input,
});

const success = (extra: Record<string, unknown> = {}): Message =>
  msg({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "done",
    structured_output: { version: 1, results: [] },
    total_cost_usd: 0.11,
    duration_ms: 31000,
    num_turns: 10,
    permission_denials: [{}, {}],
    errors: [],
    ...extra,
  });

const errorResult = (
  subtype: string,
  errors: string[] = [],
): Message =>
  msg({
    type: "result",
    subtype,
    is_error: true,
    errors,
    total_cost_usd: 0,
    duration_ms: 1,
    num_turns: 1,
    permission_denials: [],
  });

const scripted =
  (...messages: Message[]): QueryFn =>
  async function* () {
    for (const message of messages) yield message;
  };

const failing =
  (error: unknown): QueryFn =>
  () => ({
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        throw error;
      },
    }),
  });

describe("ClaudeAgentSdkRunner", () => {
  let tmp: string;
  let root: string;
  let request: AgentRunRequest;
  let events: AgentProgress[];
  const onProgress = (event: AgentProgress): void => {
    events.push(event);
  };
  const signal = (): AbortSignal => new AbortController().signal;
  const runnerOf = (
    query: QueryFn,
    executablePath: string | null = null,
    debug?: (line: string) => void,
  ): ClaudeAgentSdkRunner =>
    new ClaudeAgentSdkRunner({
      loadQuery: async () => query,
      executablePath,
      ...(debug === undefined ? {} : { debug }),
    });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "gfrun-"));
    root = tmp;
    events = [];
    request = {
      workspaceRoot: root,
      prompt: "grade",
      jsonSchema: { type: "object" },
      model: "sonnet",
      maxBudgetUsd: 3,
      timeoutMs: 5000,
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("passes exactly the verified isolation options", async () => {
    let captured: Params | null = null;
    const query: QueryFn = async function* (params) {
      captured = params;
      yield success();
    };

    await runnerOf(query).run(request, onProgress, signal());

    const scope = `//${root.slice(1)}/**`;
    expect(captured).not.toBeNull();
    const { options, prompt } = captured as unknown as Params;
    expect(prompt).toBe("grade");
    const { abortController, ...rest } = options;
    expect(abortController).toBeInstanceOf(AbortController);
    expect(rest).toEqual({
      cwd: root,
      model: "sonnet",
      tools: ["Read", "Glob", "Grep"],
      allowedTools: [`Read(${scope})`, `Glob(${scope})`, `Grep(${scope})`],
      permissionMode: "dontAsk",
      mcpServers: {},
      strictMcpConfig: true,
      settingSources: ["project"],
      persistSession: false,
      maxBudgetUsd: 3,
      outputFormat: { type: "json_schema", schema: { type: "object" } },
    });
  });

  it("sets pathToClaudeCodeExecutable only when a path is configured", async () => {
    let captured: Params | null = null;
    const query: QueryFn = async function* (params) {
      captured = params;
      yield success();
    };

    await runnerOf(query, "/opt/claude").run(
      { ...request, model: "opus", maxBudgetUsd: 1 },
      onProgress,
      signal(),
    );

    const { options } = captured as unknown as Params;
    expect(options.pathToClaudeCodeExecutable).toBe("/opt/claude");
    expect(options.model).toBe("opus");
    expect(options.maxBudgetUsd).toBe(1);
  });

  it("returns the structured output and the numbers of the result", async () => {
    const debug = jest.fn();
    const result = await runnerOf(scripted(success()), null, debug).run(
      request,
      onProgress,
      signal(),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        structuredOutput: { version: 1, results: [] },
        costUsd: 0.11,
        durationMs: 31000,
        turns: 10,
        permissionDenials: 2,
      },
    });
    expect(debug).toHaveBeenCalledWith(
      "cost=0.11 durationMs=31000 turns=10 denials=2",
    );
  });

  it("reports started, one reading per token, working per turn and finished", async () => {
    const query = scripted(
      msg({ type: "system", subtype: "init" }),
      assistant([
        { type: "text", text: "hm" },
        toolUse("Read", { file_path: `${root}/handins/aaaa1111/main.py` }),
        toolUse("Glob", { pattern: "handins/bbbb2222/**" }),
        toolUse("Write", { file_path: "handins/cccc3333/x" }),
      ]),
      assistant([toolUse("Read", { file_path: "handins/aaaa1111/util.py" })]),
      success(),
    );

    await runnerOf(query).run(request, onProgress, signal());

    expect(events).toEqual([
      { kind: "started", model: "sonnet" },
      { kind: "working", turns: 1 },
      { kind: "reading", token: "aaaa1111" },
      { kind: "reading", token: "bbbb2222" },
      { kind: "working", turns: 2 },
      { kind: "finished" },
    ]);
  });

  it.each([
    ["not absolute", () => "relative/dir"],
    ["missing", () => path.join(tmp, "nope")],
    [
      "a symlink",
      () => {
        const link = path.join(tmp, "link");
        fs.mkdirSync(path.join(tmp, "real"));
        fs.symlinkSync(path.join(tmp, "real"), link);
        return link;
      },
    ],
  ])("refuses a workspace root that is %s", async (_label, make) => {
    const loadQuery = jest.fn();
    const runner = new ClaudeAgentSdkRunner({ loadQuery, executablePath: null });

    const result = await runner.run(
      { ...request, workspaceRoot: make() },
      onProgress,
      signal(),
    );

    expect(!result.ok && result.error.code).toBe("AGENT_ERROR");
    expect(loadQuery).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  describe("result mapping", () => {
    const codeOf = async (query: QueryFn): Promise<string | null> => {
      const result = await runnerOf(query).run(request, onProgress, signal());
      return result.ok ? null : result.error.code;
    };

    it("maps a success without structured output", async () => {
      expect(
        await codeOf(scripted(success({ structured_output: undefined }))),
      ).toBe("NO_STRUCTURED_OUTPUT");
    });

    it("maps exhausted structured-output retries", async () => {
      expect(
        await codeOf(scripted(errorResult("error_max_structured_output_retries"))),
      ).toBe("NO_STRUCTURED_OUTPUT");
    });

    it("maps an exhausted budget", async () => {
      expect(await codeOf(scripted(errorResult("error_max_budget_usd")))).toBe(
        "BUDGET_EXCEEDED",
      );
    });

    it("maps a login error result", async () => {
      expect(
        await codeOf(
          scripted(
            errorResult("error_during_execution", ["Not logged in · Please run /login"]),
          ),
        ),
      ).toBe("NOT_LOGGED_IN");
    });

    it("maps a login error that comes as a failed success result", async () => {
      expect(
        await codeOf(
          scripted(
            success({
              is_error: true,
              result: "Not logged in · Please run /login",
              structured_output: undefined,
            }),
          ),
        ),
      ).toBe("NOT_LOGGED_IN");
    });

    it("maps a missing binary reported in a result", async () => {
      expect(
        await codeOf(
          scripted(
            errorResult("error_during_execution", ["native binary not found"]),
          ),
        ),
      ).toBe("NOT_INSTALLED");
    });

    it("maps any other error result to AGENT_ERROR without the raw text", async () => {
      const result = await runnerOf(
        scripted(errorResult("error_max_turns", ["secret /Users/x/handins/abc"])),
      ).run(request, onProgress, signal());
      expect(!result.ok && result.error.code).toBe("AGENT_ERROR");
      expect(!result.ok && result.error.message).not.toMatch(/secret|handins/);
    });

    it("maps an authentication failure on an assistant message without a result", async () => {
      expect(
        await codeOf(
          scripted(assistant([], { error: "authentication_failed" })),
        ),
      ).toBe("NOT_LOGGED_IN");
    });

    it("prefers the result over a later thrown error", async () => {
      const query: QueryFn = async function* () {
        yield errorResult("error_max_budget_usd");
        throw new Error("exit 1");
      };
      expect(await codeOf(query)).toBe("BUDGET_EXCEEDED");
    });

    it("maps a stream that ends without a result", async () => {
      expect(await codeOf(scripted(assistant([])))).toBe("AGENT_ERROR");
    });

    it.each([
      ["Claude Code returned an error result: Not logged in", "NOT_LOGGED_IN"],
      ["ReferenceError: Claude Code native binary not found at /x", "NOT_INSTALLED"],
      ["something broke in /Users/a/handins", "AGENT_ERROR"],
    ])("maps the thrown error %p to %s", async (message, code) => {
      const query: QueryFn = async function* () {
        yield assistant([]);
        throw new Error(message);
      };
      const result = await runnerOf(query).run(request, onProgress, signal());
      expect(!result.ok && result.error.code).toBe(code);
      expect(!result.ok && result.error.message).not.toContain("/Users");
      expect(events.some((e) => e.kind === "finished")).toBe(false);
    });

    it("maps a thrown ENOENT error code to NOT_INSTALLED", async () => {
      const query = failing(
        Object.assign(new Error("spawn failed"), { code: "ENOENT" }),
      );
      expect(await codeOf(query)).toBe("NOT_INSTALLED");
    });

    it("maps a thrown non-Error value to AGENT_ERROR", async () => {
      expect(await codeOf(failing("boom"))).toBe("AGENT_ERROR");
    });

    it("maps a failing loadQuery (SDK package missing) to NOT_INSTALLED", async () => {
      const runner = new ClaudeAgentSdkRunner({
        loadQuery: async () => {
          throw Object.assign(new Error("Cannot find package"), {
            code: "ERR_MODULE_NOT_FOUND",
          });
        },
        executablePath: null,
      });
      const result = await runner.run(request, onProgress, signal());
      expect(!result.ok && result.error.code).toBe("NOT_INSTALLED");
    });
  });

  describe("timeout and cancel", () => {
    /** Behaves like the SDK: yields once, then rejects when aborted; records that the stream was closed. */
    const hanging = (state: { closed: boolean }): QueryFn =>
      async function* ({ options }) {
        try {
          yield assistant([]);
          await new Promise<never>((_resolve, reject) => {
            options.abortController?.signal.addEventListener("abort", () =>
              reject(new Error("Claude Code process aborted by user")),
            );
          });
        } finally {
          state.closed = true;
        }
      };

    it("aborts after timeoutMs and reports TIMEOUT once the stream is closed", async () => {
      const state = { closed: false };
      const result = await runnerOf(hanging(state)).run(
        { ...request, timeoutMs: 20 },
        onProgress,
        signal(),
      );
      expect(!result.ok && result.error.code).toBe("TIMEOUT");
      expect(state.closed).toBe(true);
    });

    it("reports CANCELLED when the caller aborts and waits for the stream", async () => {
      const state = { closed: false };
      const external = new AbortController();
      const running = runnerOf(hanging(state)).run(
        request,
        (event) => {
          events.push(event);
          if (event.kind === "working") external.abort();
        },
        external.signal,
      );
      const result = await running;
      expect(!result.ok && result.error.code).toBe("CANCELLED");
      expect(state.closed).toBe(true);
    });

    it("stops reading when the stream keeps yielding after an abort", async () => {
      const external = new AbortController();
      const query: QueryFn = async function* () {
        yield assistant([]);
        external.abort();
        yield success();
      };
      const result = await runnerOf(query).run(request, onProgress, external.signal);
      expect(!result.ok && result.error.code).toBe("CANCELLED");
    });

    it("does not start when the signal is already aborted", async () => {
      const external = new AbortController();
      external.abort();
      const loadQuery = jest.fn();
      const runner = new ClaudeAgentSdkRunner({ loadQuery, executablePath: null });
      const result = await runner.run(request, onProgress, external.signal);
      expect(!result.ok && result.error.code).toBe("CANCELLED");
      expect(loadQuery).not.toHaveBeenCalled();
    });
  });
});
