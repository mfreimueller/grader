import { matchJideHandins } from "../../../../src/domain/gradeflow/JideHandinMatching";

const students = [
  { id: "s-max", firstName: "Max", lastName: "Mustermann" },
  { id: "s-anna", firstName: "Anna", lastName: "Bauer" },
  { id: "s-zoe", firstName: "Zoe", lastName: "Zorn" },
];
const names = new Map([
  ["11", "Max Mustermann"],
  ["12", "Bauer Anna"],
  ["13", "Eva Fremd"],
]);
const handins = [
  { handinId: "501", studentId: "11" },
  { handinId: "502", studentId: "12" },
  { handinId: "503", studentId: "13" },
];

describe("matchJideHandins", () => {
  it("matches a hand-in to the student linked to its J;DE student", () => {
    const result = matchJideHandins({
      handins,
      jideNames: names,
      students,
      links: new Map([["s-max", "11"], ["s-anna", "12"]]),
    });
    expect(result.entries).toEqual([
      { handin: { moodleId: "501", fullName: "Max Mustermann", alternativeNames: [], folders: [] }, match: { status: "matched", studentId: "s-max" } },
      { handin: { moodleId: "502", fullName: "Bauer Anna", alternativeNames: [], folders: [] }, match: { status: "matched", studentId: "s-anna" } },
      { handin: { moodleId: "503", fullName: "Eva Fremd", alternativeNames: [], folders: [] }, match: { status: "unmatched" } },
    ]);
    expect(result.studentIds).toEqual(["s-max", "s-anna", "s-zoe"]);
  });

  it("lists students without a hand-in and without a link", () => {
    const result = matchJideHandins({ handins, jideNames: names, students, links: new Map([["s-max", "11"]]) });
    expect(result.studentsWithoutHandin).toEqual(["s-anna", "s-zoe"]);
    expect(result.conflicts).toEqual([]);
  });

  it("leaves a hand-in ambiguous when two students link to the same J;DE student", () => {
    const result = matchJideHandins({
      handins: [{ handinId: "501", studentId: "11" }],
      jideNames: names,
      students,
      links: new Map([["s-max", "11"], ["s-anna", "11"]]),
    });
    expect(result.entries[0]?.match).toEqual({
      status: "ambiguous",
      reason: "multiple-students",
      candidateIds: ["s-max", "s-anna"],
    });
    expect(result.studentsWithoutHandin).toEqual(["s-zoe"]);
  });

  it("does not match a link to a J;DE student without a hand-in", () => {
    const result = matchJideHandins({ handins: [], jideNames: names, students, links: new Map([["s-max", "11"]]) });
    expect(result.entries).toEqual([]);
    expect(result.studentsWithoutHandin).toEqual(["s-max", "s-anna", "s-zoe"]);
  });

  it("names a hand-in of an unknown J;DE student neutrally", () => {
    const result = matchJideHandins({ handins: [{ handinId: "9", studentId: "99" }], jideNames: names, students, links: new Map() });
    expect(result.entries[0]?.handin.fullName).toBe("Unbekannte J;DE-Person");
  });
});
