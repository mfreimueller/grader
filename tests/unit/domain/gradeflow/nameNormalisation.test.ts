import {
  NAME_VARIANTS,
  nameSpellings,
  normaliseNameTokens,
  transliterateUmlauts,
} from "../../../../src/domain/gradeflow/nameNormalisation";

describe("nameNormalisation", () => {
  describe("normaliseNameTokens", () => {
    it("transliterates umlauts and sharp s in the transliterated variant", () => {
      expect(
        normaliseNameTokens("Müller Groß Äpfel Özil", "transliterated"),
      ).toEqual(["mueller", "gross", "aepfel", "oezil"]);
    });

    it("strips diacritics in the stripped variant", () => {
      expect(normaliseNameTokens("Müller Groß Äpfel", "stripped")).toEqual([
        "muller",
        "gross",
        "apfel",
      ]);
    });

    it("strips remaining diacritics in both variants", () => {
      expect(normaliseNameTokens("José", "transliterated")).toEqual(["jose"]);
      expect(normaliseNameTokens("José", "stripped")).toEqual(["jose"]);
    });

    it("treats decomposed and composed input alike", () => {
      expect(normaliseNameTokens("Müller", "transliterated")).toEqual([
        "mueller",
      ]);
    });

    it("splits on whitespace, hyphens and commas and drops empty tokens", () => {
      expect(
        normaliseNameTokens("  Huber-Maier,  Anna  Maria ", "stripped"),
      ).toEqual(["huber", "maier", "anna", "maria"]);
    });

    it("returns an empty array for blank input", () => {
      expect(normaliseNameTokens("  , - ", "stripped")).toEqual([]);
    });
  });

  describe("transliterateUmlauts", () => {
    it("keeps the case of the first letter", () => {
      expect(transliterateUmlauts("Müller ÄÖÜ äöü ß")).toBe(
        "Mueller AeOeUe aeoeue ss",
      );
    });
  });

  describe("normaliseNameTokens fold map", () => {
    it.each([
      ["Yılmaz", "yilmaz"],
      ["İzmir", "izmir"],
      ["Łukasz", "lukasz"],
      ["Øvrebo", "ovrebo"],
      ["Æble", "aeble"],
      ["Œuvre", "oeuvre"],
      ["Kovač", "kovac"],
    ])("folds %s to %s in every variant", (input, expected) => {
      for (const variant of NAME_VARIANTS) {
        expect(normaliseNameTokens(input, variant)).toEqual([expected]);
      }
    });

    it("folds đ to d or dj depending on the variant", () => {
      expect(normaliseNameTokens("Đorđević", "stripped")).toEqual(["dordevic"]);
      expect(normaliseNameTokens("Đorđević", "transliterated")).toEqual([
        "dordevic",
      ]);
      expect(normaliseNameTokens("Đorđević", "stripped-dj")).toEqual([
        "djordjevic",
      ]);
      expect(normaliseNameTokens("Đorđević", "transliterated-dj")).toEqual([
        "djordjevic",
      ]);
    });

    it("offers four variants", () => {
      expect([...NAME_VARIANTS]).toEqual([
        "transliterated",
        "stripped",
        "transliterated-dj",
        "stripped-dj",
      ]);
    });
  });

  describe("nameSpellings", () => {
    it("returns only the stored spelling for a plain name", () => {
      expect(nameSpellings("Anna")).toEqual(["Anna"]);
    });

    it("adds transliterated and stripped spellings of an umlaut name", () => {
      expect(nameSpellings("Müller")).toEqual(
        expect.arrayContaining(["Müller", "Mueller", "Muller"]),
      );
    });

    it("adds the reverse umlaut spelling for ASCII names, all occurrences", () => {
      expect(nameSpellings("Mueller")).toEqual(
        expect.arrayContaining(["Mueller", "Müller"]),
      );
      expect(nameSpellings("Schroeder-Mueller")).toContain("Schröder-Müller");
      expect(nameSpellings("Aeolus")).toContain("Äolus");
    });

    it("adds both d and dj spellings for đ", () => {
      expect(nameSpellings("Đorđević")).toEqual(
        expect.arrayContaining(["Đorđević", "Dordevic", "Djordjevic"]),
      );
      expect(nameSpellings("Đurić")).toEqual(
        expect.arrayContaining(["Duric", "Djuric"]),
      );
    });

    it("folds letters NFD does not decompose", () => {
      expect(nameSpellings("Yılmaz")).toContain("Yilmaz");
      expect(nameSpellings("İpek")).toContain("Ipek");
      expect(nameSpellings("Łukasz")).toContain("Lukasz");
      expect(nameSpellings("Øvrebo")).toContain("Ovrebo");
      expect(nameSpellings("Ærø")).toEqual(expect.arrayContaining(["Aero"]));
      expect(nameSpellings("Œ")).toContain("Oe");
      expect(nameSpellings("Kovač")).toContain("Kovac");
    });

    it("contains no duplicates", () => {
      const spellings = nameSpellings("Müller");
      expect(new Set(spellings).size).toBe(spellings.length);
    });
  });
});
