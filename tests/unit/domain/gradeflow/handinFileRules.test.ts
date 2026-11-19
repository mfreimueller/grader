import {
  archiveKind,
  classifyContent,
  isSkippedMaterialPath,
  isSkippedPath,
} from "../../../../src/domain/gradeflow/handinFileRules";

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("handinFileRules", () => {
  describe("isSkippedPath", () => {
    it.each([
      ".git",
      ".svn",
      ".idea",
      ".vscode",
      ".vs",
      "__MACOSX",
      "node_modules",
      "target",
      "bin",
      "obj",
      "build",
      "out",
      ".gradle",
      "__pycache__",
    ])("skips a path whose segment is %s", (segment) => {
      expect(isSkippedPath(segment)).toBe(true);
      expect(isSkippedPath(`src/${segment}/x/Main.java`)).toBe(true);
    });

    it("skips .DS_Store by basename", () => {
      expect(isSkippedPath(".DS_Store")).toBe(true);
      expect(isSkippedPath("src/.DS_Store")).toBe(true);
    });

    it("skips .class and .pyc files", () => {
      expect(isSkippedPath("src/Main.class")).toBe(true);
      expect(isSkippedPath("mod.pyc")).toBe(true);
    });

    it("keeps ordinary files and compares segments case-sensitively", () => {
      expect(isSkippedPath("src/Main.java")).toBe(false);
      expect(isSkippedPath("Build/Main.java")).toBe(false);
      expect(isSkippedPath("binary/Main.java")).toBe(false);
      expect(isSkippedPath("notes.class.txt")).toBe(false);
      expect(isSkippedPath("a/.DS_Store_backup")).toBe(false);
    });
  });

  describe("isSkippedMaterialPath", () => {
    it("skips everything isSkippedPath skips", () => {
      expect(isSkippedMaterialPath("src/node_modules/x.js")).toBe(true);
      expect(isSkippedMaterialPath(".git/config")).toBe(true);
      expect(isSkippedMaterialPath("src/Main.class")).toBe(true);
      expect(isSkippedMaterialPath("a/.DS_Store")).toBe(true);
    });

    it("skips a .claude segment at any depth", () => {
      expect(isSkippedMaterialPath(".claude")).toBe(true);
      expect(isSkippedMaterialPath(".claude/settings.json")).toBe(true);
      expect(isSkippedMaterialPath("a/.claude/hooks/x.sh")).toBe(true);
      expect(isSkippedMaterialPath(".Claude/settings.json")).toBe(true);
      expect(isSkippedMaterialPath("a/.CLAUDE/skills/x/SKILL.md")).toBe(true);
    });

    it("skips CLAUDE.md and CLAUDE.local.md case-insensitively", () => {
      expect(isSkippedMaterialPath("CLAUDE.md")).toBe(true);
      expect(isSkippedMaterialPath("sub/claude.md")).toBe(true);
      expect(isSkippedMaterialPath("sub/Claude.Local.md")).toBe(true);
      expect(isSkippedMaterialPath("CLAUDE.local.md")).toBe(true);
    });

    it("keeps ordinary files and look-alikes", () => {
      expect(isSkippedMaterialPath("task.md")).toBe(false);
      expect(isSkippedMaterialPath("src/Main.java")).toBe(false);
      expect(isSkippedMaterialPath("docs/CLAUDE.md.txt")).toBe(false);
      expect(isSkippedMaterialPath("claude/notes.md")).toBe(false);
      expect(isSkippedMaterialPath("x.claude/notes.md")).toBe(false);
    });
  });

  describe("classifyContent", () => {
    it("classifies plain and multi-byte UTF-8 as utf8", () => {
      expect(classifyContent(utf8("int x = 1;\n"))).toBe("utf8");
      expect(classifyContent(utf8("Größe €  😀"))).toBe("utf8");
      expect(classifyContent(new Uint8Array(0))).toBe("utf8");
      expect(classifyContent(bytes(0xef, 0xbb, 0xbf, 0x61))).toBe("utf8");
    });

    it("recognises UTF-16 by its byte order mark despite NUL bytes", () => {
      expect(classifyContent(bytes(0xff, 0xfe, 0x41, 0x00))).toBe("utf16le");
      expect(classifyContent(bytes(0xfe, 0xff, 0x00, 0x41))).toBe("utf16be");
    });

    it("classifies single-byte text with high bytes as windows-1252", () => {
      // "// Author: Max M" + 0xFC (ü) + "ller\r\n\t\f"
      const text = [...utf8("// Author: Max M"), 0xfc, ...utf8("ller\r\n\t\f")];
      expect(classifyContent(Uint8Array.from(text))).toBe("windows-1252");
    });

    it("classifies high bytes with other control bytes as binary", () => {
      expect(classifyContent(bytes(0xfc, 0x01, 0x41))).toBe("binary");
      expect(classifyContent(bytes(0xfc, 0x7f))).toBe("binary");
      expect(classifyContent(bytes(0xfc, 0x1f))).toBe("binary");
    });

    it("classifies content with a NUL byte as binary", () => {
      expect(classifyContent(bytes(0x61, 0x00, 0x62))).toBe("binary");
    });

    it("does not treat invalid UTF-8 with control bytes as text", () => {
      expect(classifyContent(bytes(0xff, 0x01, 0x41))).toBe("binary");
    });

    it("falls back to windows-1252 for invalid UTF-8 without control bytes", () => {
      expect(classifyContent(bytes(0xc3, 0x28))).toBe("windows-1252");
    });

    it("tolerates a multi-byte character cut at the end of the head", () => {
      const euro = utf8("a€"); // 61 e2 82 ac
      expect(classifyContent(euro.slice(0, 2))).toBe("utf8");
      expect(classifyContent(euro.slice(0, 3))).toBe("utf8");
      const emoji = utf8("😀");
      expect(classifyContent(emoji.slice(0, 3))).toBe("utf8");
    });
  });

  describe("archiveKind", () => {
    it("recognises zip case-insensitively", () => {
      expect(archiveKind("a.zip")).toBe("zip");
      expect(archiveKind("A.ZIP")).toBe("zip");
    });

    it.each([".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz"])(
      "marks %s as another archive",
      (ext) => {
        expect(archiveKind(`abgabe${ext}`)).toBe("other-archive");
      },
    );

    it("returns null for anything else", () => {
      expect(archiveKind("Main.java")).toBeNull();
      expect(archiveKind("zip")).toBeNull();
    });
  });
});
