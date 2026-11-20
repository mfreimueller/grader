import {
  MAX_LINE_COMMENT_LENGTH,
  MAX_LINE_COMMENTS,
  readLineComments,
  type JideFileLines,
} from "../../../../src/domain/gradeflow/LineComments";

const files: JideFileLines = new Map([
  ["Main.java", { path: "Main.java", lineCount: 10 }],
  ["src/Util.java", { path: "src/Util.java", lineCount: 3 }],
  ["Odd.java", { path: "Odd.java", lineCount: 0 }],
]);
const TOKENS = ["k3f9a2zb", "p0q8x1mm"];

const read = (raw: unknown, tokens = TOKENS) => readLineComments(raw, files, "k3f9a2zb", tokens);

describe("readLineComments", () => {
  it("keeps valid comments with the original path", () => {
    const result = read([
      { path: "Main.java", line: 4, text: "Hier fehlt ein Semikolon." },
      { path: "src/Util.java", line: 3, text: "Gut." },
    ]);
    expect(result).toEqual({
      comments: [
        { path: "Main.java", line: 4, text: "Hier fehlt ein Semikolon." },
        { path: "src/Util.java", line: 3, text: "Gut." },
      ],
      flags: [],
    });
  });

  it("treats a missing list as no comments", () => {
    expect(read(undefined)).toEqual({ comments: [], flags: [] });
  });

  it("fails on something that is not a list", () => {
    expect(read("x")).toBeNull();
    expect(read({})).toBeNull();
  });

  it("accepts the path with the folder prefix, ./ or backslashes", () => {
    const result = read([
      { path: "handins/k3f9a2zb/Main.java", line: 1, text: "a" },
      { path: "./Main.java", line: 2, text: "b" },
      { path: "src\\Util.java", line: 1, text: "c" },
    ]);
    expect(result?.comments.map((c) => c.path)).toEqual(["Main.java", "Main.java", "src/Util.java"]);
    expect(result?.flags).toEqual([]);
  });

  it.each([
    ["an unknown file", { path: "Other.java", line: 1, text: "x" }],
    ["a line below 1", { path: "Main.java", line: 0, text: "x" }],
    ["a line beyond the file", { path: "Main.java", line: 11, text: "x" }],
    ["a fractional line", { path: "Main.java", line: 1.5, text: "x" }],
    ["a file whose lines are unknown", { path: "Odd.java", line: 1, text: "x" }],
    ["a text that is not a string", { path: "Main.java", line: 1, text: 5 }],
    ["an empty text", { path: "Main.java", line: 1, text: "  " }],
    ["a path outside the hand-in", { path: "../Main.java", line: 1, text: "x" }],
    ["a comment that is not an object", "Main.java:1"],
  ])("drops %s and flags it", (_name, entry) => {
    expect(read([entry, { path: "Main.java", line: 2, text: "ok" }])).toEqual({
      comments: [{ path: "Main.java", line: 2, text: "ok" }],
      flags: ["LINE_COMMENT_DROPPED"],
    });
  });

  it("removes tokens from the text and flags it", () => {
    const result = read([{ path: "Main.java", line: 1, text: "k3f9a2zb: gut" }]);
    expect(result).toEqual({
      comments: [{ path: "Main.java", line: 1, text: ": gut" }],
      flags: ["TOKEN_IN_COMMENT"],
    });
  });

  it("drops a comment that only consisted of a token", () => {
    const result = read([{ path: "Main.java", line: 1, text: "k3f9a2zb" }]);
    expect(result).toEqual({ comments: [], flags: ["TOKEN_IN_COMMENT", "LINE_COMMENT_DROPPED"] });
  });

  it("truncates a long text and flags it", () => {
    const result = read([{ path: "Main.java", line: 1, text: "x".repeat(MAX_LINE_COMMENT_LENGTH + 50) }]);
    expect(result?.comments[0]?.text).toHaveLength(MAX_LINE_COMMENT_LENGTH);
    expect(result?.flags).toEqual(["COMMENT_TRUNCATED"]);
  });

  it("keeps the first comments when there are too many", () => {
    const many = Array.from({ length: MAX_LINE_COMMENTS + 3 }, () => ({ path: "Main.java", line: 1, text: "x" }));
    const result = read(many);
    expect(result?.comments).toHaveLength(MAX_LINE_COMMENTS);
    expect(result?.flags).toEqual(["LINE_COMMENT_DROPPED"]);
  });

  it("lists each flag once", () => {
    const result = read([
      { path: "Nope", line: 1, text: "x" },
      { path: "Nope", line: 2, text: "x" },
    ]);
    expect(result?.flags).toEqual(["LINE_COMMENT_DROPPED"]);
  });
});
