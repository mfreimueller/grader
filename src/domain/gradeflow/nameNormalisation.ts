// Shared, pure name normalisation for hand-in matching and name scrubbing.

export const NAME_VARIANTS = [
  "transliterated",
  "stripped",
  "transliterated-dj",
  "stripped-dj",
] as const;
export type NameVariant = (typeof NAME_VARIANTS)[number];

/** ä→ae, ö→oe, ü→ue, ß→ss (first letter keeps its case). Input is NFC-normalised first. */
export function transliterateUmlauts(text: string): string {
  return text
    .normalize("NFC")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss");
}

function removeCombiningMarks(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

/** Letters NFD does not decompose. đ/Đ become d/D or dj/Dj ("Djordjevic" vs "Dordevic"). */
function foldLetters(text: string, dj: boolean): string {
  return text
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/đ/g, dj ? "dj" : "d")
    .replace(/Đ/g, dj ? "Dj" : "D")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe");
}

/** ae→ä, oe→ö, ue→ü (all occurrences) for names stored in ASCII spelling. */
function reverseUmlauts(text: string): string {
  return text
    .replace(/ae/g, "ä")
    .replace(/oe/g, "ö")
    .replace(/ue/g, "ü")
    .replace(/Ae/g, "Ä")
    .replace(/Oe/g, "Ö")
    .replace(/Ue/g, "Ü");
}

/**
 * Lower-cased name tokens, split on whitespace, "-" and ",".
 * - 'transliterated': Müller → mueller (other diacritics are stripped)
 * - 'stripped':       Müller → muller, ß → ss
 * The "-dj" variants fold đ to "dj" instead of "d". Callers compare all variants,
 * so "Müller", "Mueller" and "Muller" (and "Đorđević"/"Dordevic"/"Djordjevic") match.
 */
export function normaliseNameTokens(
  text: string,
  variant: NameVariant,
): string[] {
  const folded = variant.startsWith("transliterated")
    ? transliterateUmlauts(text)
    : text.normalize("NFC").replace(/ß/g, "ss");
  return removeCombiningMarks(foldLetters(folded, variant.endsWith("-dj")))
    .toLowerCase()
    .split(/[\s,-]+/)
    .filter((token) => token.length > 0);
}

/**
 * Every spelling a name may be written in (deduplicated, stored spelling first): as stored,
 * umlaut-transliterated, diacritics stripped, folded (đ both ways), plus the reverse umlaut
 * spelling of the stored name.
 */
export function nameSpellings(name: string): string[] {
  const stored = name.normalize("NFC");
  const spellings = new Set<string>([stored]);
  for (const base of [stored, transliterateUmlauts(stored)]) {
    for (const form of [base, removeCombiningMarks(base)]) {
      spellings.add(form);
      spellings.add(foldLetters(form, false));
      spellings.add(foldLetters(form, true));
    }
  }
  spellings.add(reverseUmlauts(stored));
  return [...spellings];
}
