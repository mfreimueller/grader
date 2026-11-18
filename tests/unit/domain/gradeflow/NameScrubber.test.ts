import {
  scrubNames,
  SCRUB_PLACEHOLDER,
} from "../../../../src/domain/gradeflow/NameScrubber";

const aStudent = (overrides?: { firstName?: string; lastName?: string }) => ({
  firstName: "Anna",
  lastName: "Beispiel",
  ...overrides,
});

describe("NameScrubber", () => {
  describe("scrubNames full names", () => {
    it("uses the constant placeholder STUDENT", () => {
      expect(SCRUB_PLACEHOLDER).toBe("STUDENT");
    });

    it.each([
      ["Author: Anna Beispiel", "Author: STUDENT"],
      ["Author: Beispiel Anna", "Author: STUDENT"],
      ["Author: Beispiel, Anna", "Author: STUDENT"],
      ["Author: Beispiel ,Anna", "Author: STUDENT"],
      ["Author: ANNA   BEISPIEL", "Author: STUDENT"],
      ["Author: anna\n\tbeispiel", "Author: STUDENT"],
    ])('replaces "%s"', (text, expected) => {
      const result = scrubNames(text, [aStudent()]);
      expect(result.text).toBe(expected);
      expect(result.replacements).toBe(1);
    });

    it("counts every replacement", () => {
      const result = scrubNames("Anna Beispiel and Beispiel Anna", [
        aStudent(),
      ]);
      expect(result.text).toBe("STUDENT and STUDENT");
      expect(result.replacements).toBe(2);
    });

    it("matches the ae-transliterated spelling", () => {
      const result = scrubNames("Anna Mueller / Müller Anna", [
        aStudent({ lastName: "Müller" }),
      ]);
      expect(result.text).toBe("STUDENT / STUDENT");
    });

    it("also replaces the first token of a multi-part first name", () => {
      const student = aStudent({ firstName: "Anna Maria" });
      expect(scrubNames("Anna Maria Beispiel", [student]).text).toBe("STUDENT");
      expect(scrubNames("Anna Beispiel", [student]).text).toBe("STUDENT");
      expect(scrubNames("Maria Beispiel", [student]).text).toBe(
        "Maria Beispiel",
      );
    });

    it("replaces the longer name first", () => {
      const students = [
        aStudent({ firstName: "Anna" }),
        aStudent({ firstName: "Anna Maria" }),
      ];
      const result = scrubNames("Anna Maria Beispiel", students);
      expect(result.text).toBe("STUDENT");
      expect(result.replacements).toBe(1);
    });

    it("does not touch other people or names that are not adjacent", () => {
      const result = scrubNames("Anna Meier Beispiel and Ben Beispiel", [
        aStudent(),
      ]);
      expect(result.text).toBe("Anna Meier Beispiel and Ben Beispiel");
      expect(result.replacements).toBe(0);
    });

    it("replaces full names inside longer words (no outer boundary)", () => {
      const result = scrubNames("äAnna Beispiel; Annabeispielx", [aStudent()]);
      expect(result.text).toBe("äSTUDENT; STUDENTx");
      expect(result.replacements).toBe(2);
    });

    it("escapes regex metacharacters in names", () => {
      const student = aStudent({ firstName: "A.nna", lastName: "Be(is)piel+" });
      const result = scrubNames("A.nna Be(is)piel+ and Axnna Be(is)piel+", [
        student,
      ]);
      expect(result.text).toBe("STUDENT and Axnna Be(is)piel+");
    });

    it("leaves text alone when there are no students or blank names", () => {
      expect(scrubNames("Anna Beispiel", []).text).toBe("Anna Beispiel");
      const blank = scrubNames("Anna", [
        aStudent({ firstName: "", lastName: " " }),
      ]);
      expect(blank).toEqual({
        text: "Anna",
        replacements: 0,
        loneNameHits: [],
      });
    });
  });

  describe("scrubNames glued names", () => {
    const max = { firstName: "Max", lastName: "Mustermann" };

    it.each([
      ["Max_Mustermann", "STUDENT"],
      ["max.mustermann", "STUDENT"],
      ["max-mustermann", "STUDENT"],
      ["MaxMustermann", "STUDENT"],
      ["mustermann_max", "STUDENT"],
      ["mustermann.max", "STUDENT"],
      ["mustermannmax", "STUDENT"],
      ["max_mustermann_test", "STUDENT_test"],
      ["MaxMustermannTest", "STUDENTTest"],
      ["max.mustermann@school.at", "STUDENT@school.at"],
    ])('replaces "%s"', (text, expected) => {
      const result = scrubNames(text, [max]);
      expect(result.text).toBe(expected);
      expect(result.replacements).toBe(1);
    });

    it("prefers the longer name when glued", () => {
      const students = [
        max,
        { firstName: "Max Moritz", lastName: "Mustermann" },
      ];
      expect(scrubNames("max_moritz_mustermann", students).text).toBe(
        "STUDENT",
      );
    });
  });

  describe("scrubNames spelling variants", () => {
    it.each([
      ["Đorđević", "Dordevic Anna", "STUDENT"],
      ["Đorđević", "Djordjevic, Anna", "STUDENT"],
      ["Đorđević", "anna_djordjevic", "STUDENT"],
      ["Đorđević", "Anna Đorđević", "STUDENT"],
      ["Yılmaz", "Anna Yilmaz", "STUDENT"],
      ["Kovač", "Anna Kovac", "STUDENT"],
      ["Łukasz", "Anna Lukasz", "STUDENT"],
      ["Müller", "Anna Muller", "STUDENT"],
      ["Müller", "Anna Mueller", "STUDENT"],
      ["Mueller", "Anna Müller", "STUDENT"],
      ["Groß", "Anna Gross", "STUDENT"],
    ])('stored "%s" also matches "%s"', (lastName, text, expected) => {
      expect(scrubNames(text, [aStudent({ lastName })]).text).toBe(expected);
    });

    it("also handles first-name variants", () => {
      const student = aStudent({ firstName: "Ömer", lastName: "Beispiel" });
      expect(scrubNames("Omer Beispiel / Oemer Beispiel", [student]).text).toBe(
        "STUDENT / STUDENT",
      );
    });
  });

  describe("scrubNames lone names", () => {
    it("counts last names inside identifiers but first names only as whole words", () => {
      const student = { firstName: "Max", lastName: "Mustermann" };
      const result = scrubNames(
        "mustermann_helper; getMustermann; maxHelper max_value max",
        [student],
      );
      expect(result.loneNameHits).toEqual([
        { name: "Max", count: 1 },
        { name: "Mustermann", count: 2 },
      ]);
    });

    it("counts last-name spellings inside identifiers", () => {
      const result = scrubNames("getMueller Muller_x", [
        aStudent({ lastName: "Müller" }),
      ]);
      expect(result.loneNameHits).toEqual([{ name: "Müller", count: 2 }]);
    });

    it("counts last names shorter than 3 characters as whole words only", () => {
      const result = scrubNames("Li said light, Li", [
        aStudent({ firstName: "Ben", lastName: "Li" }),
      ]);
      expect(result.loneNameHits).toEqual([{ name: "Li", count: 2 }]);
    });

    it("treats a name that is first and last name of different students as a last name", () => {
      const students = [
        aStudent({ firstName: "Berg", lastName: "Huber" }),
        aStudent({ firstName: "Ben", lastName: "Berg" }),
      ];
      expect(scrubNames("getBerg", students).loneNameHits).toEqual([
        { name: "Berg", count: 1 },
      ]);
    });

    it("reports but does not replace lone first and last names", () => {
      const result = scrubNames("anna wrote max and Beispiel and BEISPIEL", [
        aStudent(),
      ]);
      expect(result.text).toBe("anna wrote max and Beispiel and BEISPIEL");
      expect(result.loneNameHits).toEqual([
        { name: "Anna", count: 1 },
        { name: "Beispiel", count: 2 },
      ]);
    });

    it("counts only what remains after the full-name replacement", () => {
      const result = scrubNames("Anna Beispiel said Anna", [aStudent()]);
      expect(result.loneNameHits).toEqual([{ name: "Anna", count: 1 }]);
    });

    it("omits names with zero hits", () => {
      expect(scrubNames("nothing here", [aStudent()]).loneNameHits).toEqual([]);
    });

    it("uses the first token of a multi-part first name and counts transliterations", () => {
      const student = aStudent({ firstName: "Anna Maria", lastName: "Müller" });
      const result = scrubNames("Anna and Mueller Müller", [student]);
      expect(result.loneNameHits).toEqual([
        { name: "Anna", count: 1 },
        { name: "Müller", count: 2 },
      ]);
    });

    it("reports a name shared by several students once", () => {
      const students = [
        aStudent({ firstName: "Anna" }),
        aStudent({ firstName: "Berta" }),
      ];
      const result = scrubNames("Beispiel", students);
      expect(result.loneNameHits).toEqual([{ name: "Beispiel", count: 1 }]);
    });

    it("does not count identifiers that merely contain a name", () => {
      const result = scrubNames("max_value annamaria", [
        aStudent({ firstName: "Max", lastName: "Long" }),
      ]);
      expect(result.loneNameHits).toEqual([]);
    });
  });
});
