import { PseudonymMap } from "../../../../src/domain/gradeflow/PseudonymMap";

const sequence = (values: number[]) => {
  let i = 0;
  return (exclusiveMax: number): number =>
    (values[i++ % values.length] ?? 0) % exclusiveMax;
};

const pseudoRandom = (): ((max: number) => number) => {
  let seed = 7;
  return (max) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % max;
  };
};

describe("PseudonymMap", () => {
  describe("create", () => {
    it("gives every student a unique 8-character token of lowercase letters and digits", () => {
      const ids = Array.from({ length: 50 }, (_, i) => `s-${i}`);
      const result = PseudonymMap.create(ids, pseudoRandom());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const tokens = result.value.tokens();
      expect(new Set(tokens).size).toBe(50);
      for (const token of tokens) expect(token).toMatch(/^[a-z0-9]{8}$/);
      expect(result.value.size).toBe(50);
    });

    it("retries when a generated token collides", () => {
      // first token: indices 0 x8 -> "aaaaaaaa"; second attempt repeats it, third differs
      const random = sequence([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
      ]);
      const result = PseudonymMap.create(["s-1", "s-2"], random);
      expect(result.ok && result.value.tokenOf("s-1")).toBe("aaaaaaaa");
      expect(result.ok && result.value.tokenOf("s-2")).toBe("bbbbbbbb");
    });

    it("fails instead of looping forever when no unique token can be found", () => {
      const result = PseudonymMap.create(["s-1", "s-2"], () => 0);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe("ValidationError");
    });

    it("fails when randomIndex returns an index outside the alphabet", () => {
      const result = PseudonymMap.create(["s-1"], () => 99);
      expect(result.ok).toBe(false);
    });

    it("fails for duplicate student ids", () => {
      const result = PseudonymMap.create(["s-1", "s-1"], pseudoRandom());
      expect(result.ok).toBe(false);
    });

    it("creates an empty map for no students", () => {
      const result = PseudonymMap.create([], pseudoRandom());
      expect(result.ok && result.value.size).toBe(0);
    });
  });

  describe("lookups", () => {
    const map = (() => {
      const result = PseudonymMap.create(["s-1", "s-2"], pseudoRandom());
      if (!result.ok) throw result.error;
      return result.value;
    })();

    it("maps student to token and back", () => {
      const token = map.tokenOf("s-1");
      expect(token).not.toBeNull();
      expect(map.studentOf(token ?? "")).toBe("s-1");
    });

    it("returns null for unknown ids and tokens", () => {
      expect(map.tokenOf("s-9")).toBeNull();
      expect(map.studentOf("zzzzzzzz")).toBeNull();
    });

    it("lists student ids in creation order and does not leak internal state", () => {
      expect(map.studentIds()).toEqual(["s-1", "s-2"]);
      map.tokens().push("x");
      map.studentIds().push("x");
      expect(map.size).toBe(2);
      expect(map.tokens()).toHaveLength(2);
    });
  });
});
