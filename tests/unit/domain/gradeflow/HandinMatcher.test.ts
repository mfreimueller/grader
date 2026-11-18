import { Handin } from "../../../../src/domain/gradeflow/MoodleHandinFolder";
import {
  confirmMatches,
  matchHandins,
  StudentName,
} from "../../../../src/domain/gradeflow/HandinMatcher";

const aStudent = (overrides?: Partial<StudentName>): StudentName => ({
  id: "s-1",
  firstName: "Anna",
  lastName: "Beispiel",
  ...overrides,
});

const aHandin = (overrides?: Partial<Handin>): Handin => ({
  moodleId: "100",
  fullName: "Anna Beispiel",
  alternativeNames: [],
  folders: ["Anna Beispiel_100_assignsubmission_file"],
  ...overrides,
});

const matchOf = (fullName: string, student: StudentName) =>
  matchHandins([aHandin({ fullName })], [student]).entries[0]?.match;

describe("HandinMatcher", () => {
  describe("matchHandins name matching", () => {
    it.each([
      "Anna Beispiel",
      "Beispiel Anna",
      "Beispiel, Anna",
      "ANNA BEISPIEL",
      "Anna Sophie Beispiel",
    ])('matches "%s"', (fullName) => {
      expect(matchOf(fullName, aStudent())).toEqual({
        status: "matched",
        studentId: "s-1",
      });
    });

    it.each(["Müller", "Mueller", "Muller"])(
      'matches umlaut spelling "%s"',
      (lastName) => {
        const student = aStudent({ lastName: "Müller" });
        expect(matchOf(`Anna ${lastName}`, student)).toEqual({
          status: "matched",
          studentId: "s-1",
        });
      },
    );

    it("matches a transliterated student name against an umlaut hand-in", () => {
      const student = aStudent({ lastName: "Mueller" });
      expect(matchOf("Anna Müller", student)).toEqual({
        status: "matched",
        studentId: "s-1",
      });
    });

    it.each([
      ["Đorđević", "Dordevic"],
      ["Đorđević", "Djordjevic"],
      ["Dordevic", "Đorđević"],
      ["Djordjevic", "Đorđević"],
      ["Yılmaz", "Yilmaz"],
      ["Kovač", "Kovac"],
      ["Mueller", "Müller"],
    ])(
      'matches stored "%s" against hand-in spelling "%s"',
      (lastName, spelling) => {
        expect(matchOf(`Anna ${spelling}`, aStudent({ lastName }))).toEqual({
          status: "matched",
          studentId: "s-1",
        });
      },
    );

    it("requires all last-name tokens", () => {
      const student = aStudent({ lastName: "van der Berg" });
      expect(matchOf("Anna van Berg", student)).toEqual({
        status: "unmatched",
      });
      expect(matchOf("Anna van der Berg", student)).toEqual({
        status: "matched",
        studentId: "s-1",
      });
    });

    it("uses only the first token of a multi-part first name", () => {
      const student = aStudent({ firstName: "Anna Maria" });
      expect(matchOf("Anna Beispiel", student)).toEqual({
        status: "matched",
        studentId: "s-1",
      });
      expect(matchOf("Maria Beispiel", student)).toEqual({
        status: "unmatched",
      });
    });

    it("does not match on the last name alone", () => {
      expect(matchOf("Ben Beispiel", aStudent())).toEqual({
        status: "unmatched",
      });
    });

    it("never matches a student with a blank first or last name", () => {
      expect(matchOf("Anna Beispiel", aStudent({ firstName: " " }))).toEqual({
        status: "unmatched",
      });
      expect(matchOf("Anna Beispiel", aStudent({ lastName: "" }))).toEqual({
        status: "unmatched",
      });
    });
  });

  describe("matchHandins results", () => {
    it("marks a hand-in matching several students as ambiguous", () => {
      const students = [aStudent({ id: "s-1" }), aStudent({ id: "s-2" })];
      const result = matchHandins([aHandin()], students);
      expect(result.entries[0]?.match).toEqual({
        status: "ambiguous",
        reason: "multiple-students",
        candidateIds: ["s-1", "s-2"],
      });
      expect(result.studentsWithoutHandin).toEqual([]);
    });

    it("marks hand-ins claiming the same single student as conflicting", () => {
      const result = matchHandins(
        [aHandin({ moodleId: "1" }), aHandin({ moodleId: "2" })],
        [aStudent()],
      );
      for (const entry of result.entries) {
        expect(entry.match).toEqual({
          status: "ambiguous",
          reason: "student-claimed-by-multiple-handins",
          candidateIds: ["s-1"],
        });
      }
      expect(result.conflicts).toEqual([
        { studentId: "s-1", moodleIds: ["1", "2"] },
      ]);
    });

    it("lists students without any hand-in and keeps all student ids", () => {
      const students = [
        aStudent({ id: "s-1" }),
        aStudent({ id: "s-2", firstName: "Ben", lastName: "Muster" }),
      ];
      const result = matchHandins([aHandin()], students);
      expect(result.studentsWithoutHandin).toEqual(["s-2"]);
      expect(result.studentIds).toEqual(["s-1", "s-2"]);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("confirmMatches", () => {
    const twoStudents = [
      aStudent({ id: "s-1" }),
      aStudent({ id: "s-2", firstName: "Ben", lastName: "Muster" }),
    ];

    it("takes matched hand-ins as they are, with their folders", () => {
      const result = confirmMatches(
        matchHandins([aHandin()], twoStudents),
        new Map(),
      );
      expect(result).toEqual({
        ok: true,
        value: [
          {
            moodleId: "100",
            studentId: "s-1",
            folders: ["Anna Beispiel_100_assignsubmission_file"],
          },
        ],
      });
    });

    it("lets an override replace the automatic match", () => {
      const result = confirmMatches(
        matchHandins([aHandin()], twoStudents),
        new Map([["100", "s-2"]]),
      );
      expect(result.ok && result.value[0]?.studentId).toBe("s-2");
    });

    it("resolves an unmatched hand-in with an override", () => {
      const result = confirmMatches(
        matchHandins([aHandin({ fullName: "Nobody" })], twoStudents),
        new Map([["100", "s-1"]]),
      );
      expect(result.ok && result.value[0]?.studentId).toBe("s-1");
    });

    it("skips a hand-in overridden with null", () => {
      const result = confirmMatches(
        matchHandins([aHandin()], twoStudents),
        new Map([["100", null]]),
      );
      expect(result).toEqual({ ok: true, value: [] });
    });

    it("skips unresolved hand-ins without an override", () => {
      const result = confirmMatches(
        matchHandins([aHandin({ fullName: "Nobody" })], twoStudents),
        new Map(),
      );
      expect(result).toEqual({ ok: true, value: [] });
    });

    it("fails when an override names an unknown student", () => {
      const result = confirmMatches(
        matchHandins([aHandin()], twoStudents),
        new Map([["100", "s-99"]]),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe("ValidationError");
    });

    it("fails when an override names an unknown hand-in", () => {
      const result = confirmMatches(
        matchHandins([aHandin()], twoStudents),
        new Map([["999", "s-1"]]),
      );
      expect(result.ok).toBe(false);
    });

    it("fails when one student would be assigned twice", () => {
      const result = confirmMatches(
        matchHandins(
          [aHandin({ moodleId: "1" }), aHandin({ moodleId: "2" })],
          twoStudents,
        ),
        new Map([
          ["1", "s-1"],
          ["2", "s-1"],
        ]),
      );
      expect(result.ok).toBe(false);
    });
  });
});
