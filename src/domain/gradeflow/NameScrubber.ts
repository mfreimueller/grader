import { nameSpellings } from "./nameNormalisation";

export const SCRUB_PLACEHOLDER = "STUDENT";

export interface ScrubStudent {
  firstName: string;
  lastName: string;
}

export interface LoneNameHit {
  name: string;
  count: number;
}

export interface ScrubResult {
  text: string;
  replacements: number;
  loneNameHits: LoneNameHit[];
}

const BEFORE = "(?<![\\p{L}\\p{N}_])";
const AFTER = "(?![\\p{L}\\p{N}_])";

// Glued forms ("max_mustermann", "MaxMustermann", "mustermann.max") are replaced even when
// embedded in longer identifiers or e-mail addresses, so full names have no outer boundary at
// all: one simple rule for spaced, comma and glued forms alike.
const FIRST_LAST = "(?:\\s+|[_.\\-]?)";
const LAST_FIRST = "(?:\\s+|\\s*,\\s*|[_.\\-]?)";

// Last names shorter than this are only reported as whole words ("Li", "Ng" would match
// inside countless identifiers).
const MIN_SUBSTRING_LAST_NAME_LENGTH = 3;

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const words = (name: string): string[] =>
  name.split(/\s+/).filter((word) => word.length > 0);

// Parts of a multi-word name may be glued as well ("anna_maria").
const phrase = (name: string): string =>
  words(name).map(escapeRegex).join(FIRST_LAST);

const normalised = (name: string): string => words(name).join(" ");

function compile(alternatives: string[], wholeWord: boolean): RegExp {
  const body = `(?:${alternatives.join("|")})`;
  return new RegExp(wholeWord ? `${BEFORE}${body}${AFTER}` : body, "giu");
}

function fullNameAlternatives(students: ScrubStudent[]): string[] {
  const phrases: Array<{ length: number; source: string }> = [];
  for (const { firstName, lastName } of students) {
    const firstNames = new Set(
      [firstName, words(firstName)[0] ?? ""].filter((n) => n.trim()),
    );
    if (firstNames.size === 0 || words(lastName).length === 0) continue;
    for (const first of firstNames) {
      for (const f of nameSpellings(normalised(first))) {
        for (const l of nameSpellings(normalised(lastName))) {
          const [pf, pl] = [phrase(f), phrase(l)];
          const length = f.length + l.length;
          phrases.push({ length, source: `${pf}${FIRST_LAST}${pl}` });
          phrases.push({ length, source: `${pl}${LAST_FIRST}${pf}` });
        }
      }
    }
  }
  // Longest first so "Anna Maria Huber" wins over "Anna Huber" at the same position.
  return [
    ...new Set(
      phrases.sort((a, b) => b.length - a.length).map((p) => p.source),
    ),
  ];
}

interface LoneName {
  name: string;
  /** Last names (3+ characters) are also counted inside identifiers; first names never. */
  substring: boolean;
}

function loneNames(students: ScrubStudent[]): LoneName[] {
  const unique = new Map<string, LoneName>();
  const add = (name: string, substring: boolean): void => {
    const key = name.toLowerCase();
    const existing = unique.get(key);
    if (existing) existing.substring ||= substring;
    else if (name) unique.set(key, { name, substring });
  };
  for (const { firstName, lastName } of students) {
    add(words(firstName)[0] ?? "", false);
    const last = normalised(lastName);
    add(last, last.length >= MIN_SUBSTRING_LAST_NAME_LENGTH);
  }
  return [...unique.values()];
}

export function scrubNames(
  text: string,
  students: ScrubStudent[],
): ScrubResult {
  let replacements = 0;
  let scrubbed = text;
  const alternatives = fullNameAlternatives(students);
  if (alternatives.length > 0) {
    scrubbed = text.replace(compile(alternatives, false), () => {
      replacements++;
      return SCRUB_PLACEHOLDER;
    });
  }

  const loneNameHits: LoneNameHit[] = [];
  for (const { name, substring } of loneNames(students)) {
    const pattern = compile(nameSpellings(name).map(phrase), !substring);
    const count = scrubbed.match(pattern)?.length ?? 0;
    if (count > 0) loneNameHits.push({ name, count });
  }
  return { text: scrubbed, replacements, loneNameHits };
}
