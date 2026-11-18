import {
  groupHandins,
  parseMoodleHandinFolder,
} from "../../../../src/domain/gradeflow/MoodleHandinFolder";

describe("MoodleHandinFolder", () => {
  describe("parseMoodleHandinFolder", () => {
    it("parses a file hand-in folder", () => {
      const result = parseMoodleHandinFolder(
        "Anna Beispiel_12345_assignsubmission_file",
      );
      expect(result).toEqual({
        ok: true,
        value: {
          folderName: "Anna Beispiel_12345_assignsubmission_file",
          fullName: "Anna Beispiel",
          moodleId: "12345",
          kind: "file",
        },
      });
    });

    it("parses an onlinetext hand-in folder", () => {
      const result = parseMoodleHandinFolder(
        "Anna Beispiel_12345_assignsubmission_onlinetext",
      );
      expect(result.ok && result.value.kind).toBe("onlinetext");
    });

    it("accepts an optional trailing underscore", () => {
      const result = parseMoodleHandinFolder(
        "Anna Beispiel_12345_assignsubmission_file_",
      );
      expect(result.ok && result.value.kind).toBe("file");
      expect(result.ok && result.value.fullName).toBe("Anna Beispiel");
      expect(result.ok && result.value.folderName).toBe(
        "Anna Beispiel_12345_assignsubmission_file_",
      );
    });

    it("anchors from the right when the name contains underscores and digits", () => {
      const result = parseMoodleHandinFolder(
        "Max_2_Muster_777_assignsubmission_file",
      );
      expect(result.ok && result.value.fullName).toBe("Max_2_Muster");
      expect(result.ok && result.value.moodleId).toBe("777");
    });

    it.each([
      "notes",
      "Anna_assignsubmission_file",
      "Anna_12_assignsubmission_other",
      "_12_assignsubmission_file",
      "Anna_12_assignsubmission_file_extra",
    ])('rejects "%s" with a ValidationError', (name) => {
      const result = parseMoodleHandinFolder(name);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.name).toBe("ValidationError");
    });
  });

  describe("groupHandins", () => {
    it("groups file and onlinetext folders of one moodleId into one hand-in", () => {
      const grouped = groupHandins([
        "Anna Beispiel_1_assignsubmission_file",
        "Ben Muster_2_assignsubmission_file",
        "Anna Beispiel_1_assignsubmission_onlinetext",
      ]);
      expect(grouped.handins).toEqual([
        {
          moodleId: "1",
          fullName: "Anna Beispiel",
          alternativeNames: [],
          folders: [
            "Anna Beispiel_1_assignsubmission_file",
            "Anna Beispiel_1_assignsubmission_onlinetext",
          ],
        },
        {
          moodleId: "2",
          fullName: "Ben Muster",
          alternativeNames: [],
          folders: ["Ben Muster_2_assignsubmission_file"],
        },
      ]);
      expect(grouped.unrecognised).toEqual([]);
    });

    it("lists unrecognised folders separately", () => {
      const grouped = groupHandins([
        "readme.txt",
        "Ben Muster_2_assignsubmission_file",
      ]);
      expect(grouped.unrecognised).toEqual(["readme.txt"]);
      expect(grouped.handins).toHaveLength(1);
    });

    it("surfaces differing names of the same moodleId as alternativeNames, once", () => {
      const grouped = groupHandins([
        "Anna Beispiel_1_assignsubmission_file",
        "Anna B._1_assignsubmission_onlinetext",
        "Anna B._1_assignsubmission_file",
      ]);
      expect(grouped.handins).toHaveLength(1);
      expect(grouped.handins[0]?.fullName).toBe("Anna Beispiel");
      expect(grouped.handins[0]?.alternativeNames).toEqual(["Anna B."]);
      expect(grouped.handins[0]?.folders).toHaveLength(3);
    });

    it("returns empty lists for no folders", () => {
      expect(groupHandins([])).toEqual({ handins: [], unrecognised: [] });
    });
  });
});
