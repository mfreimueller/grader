import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 8;
const MAX_ATTEMPTS_PER_TOKEN = 100;

/** Per-run, random student tokens. Immutable; lives in memory only. */
export class PseudonymMap {
  private constructor(
    private readonly tokenByStudent: ReadonlyMap<string, string>,
    private readonly studentByToken: ReadonlyMap<string, string>,
  ) {}

  /** `randomIndex(n)` must return an integer in [0, n). It is injected to keep the domain pure. */
  static create(
    studentIds: string[],
    randomIndex: (exclusiveMax: number) => number,
  ): Result<PseudonymMap> {
    const tokenByStudent = new Map<string, string>();
    const studentByToken = new Map<string, string>();
    for (const studentId of studentIds) {
      if (tokenByStudent.has(studentId)) {
        return Result.fail(
          new ValidationError(`Duplicate student id: ${studentId}`),
        );
      }
      const token = PseudonymMap.uniqueToken(studentByToken, randomIndex);
      if (!token.ok) return Result.fail(token.error);
      tokenByStudent.set(studentId, token.value);
      studentByToken.set(token.value, studentId);
    }
    return Result.ok(new PseudonymMap(tokenByStudent, studentByToken));
  }

  private static uniqueToken(
    taken: ReadonlyMap<string, string>,
    randomIndex: (exclusiveMax: number) => number,
  ): Result<string> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TOKEN; attempt++) {
      let token = "";
      for (let i = 0; i < TOKEN_LENGTH; i++) {
        const char = ALPHABET[randomIndex(ALPHABET.length)];
        if (char === undefined) {
          return Result.fail(
            new ValidationError("randomIndex returned an index out of range"),
          );
        }
        token += char;
      }
      if (!taken.has(token)) return Result.ok(token);
    }
    return Result.fail(
      new ValidationError("Could not generate a unique pseudonym token"),
    );
  }

  get size(): number {
    return this.tokenByStudent.size;
  }

  tokenOf(studentId: string): string | null {
    return this.tokenByStudent.get(studentId) ?? null;
  }

  studentOf(token: string): string | null {
    return this.studentByToken.get(token) ?? null;
  }

  tokens(): string[] {
    return [...this.studentByToken.keys()];
  }

  studentIds(): string[] {
    return [...this.tokenByStudent.keys()];
  }
}
