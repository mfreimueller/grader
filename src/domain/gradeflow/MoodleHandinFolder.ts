import { Result } from "../shared/Result";
import { ValidationError } from "../../shared/errors";

export type HandinKind = "file" | "onlinetext";

export interface MoodleHandinFolder {
  folderName: string;
  fullName: string;
  moodleId: string;
  kind: HandinKind;
}

/** All folders of one Moodle participant (the file and onlinetext folders form ONE hand-in). */
export interface Handin {
  moodleId: string;
  /** Name taken from the first folder seen for this moodleId. */
  fullName: string;
  /** Other, differing names seen for the same moodleId (normally empty) — surfaced for the teacher. */
  alternativeNames: string[];
  folders: string[];
}

export interface GroupedHandins {
  handins: Handin[];
  unrecognised: string[];
}

// Anchored from the right: the name itself may contain "_" and digits.
// Some Moodle versions append a trailing "_".
const FOLDER_PATTERN = /^(.+)_(\d+)_assignsubmission_(file|onlinetext)_?$/;

export function parseMoodleHandinFolder(
  folderName: string,
): Result<MoodleHandinFolder> {
  const match = FOLDER_PATTERN.exec(folderName);
  if (!match) {
    return Result.fail(
      new ValidationError(`Not a Moodle hand-in folder: "${folderName}"`),
    );
  }
  const [, fullName, moodleId, kind] = match as RegExpExecArray &
    [string, string, string, HandinKind];
  return Result.ok({ folderName, fullName, moodleId, kind });
}

export function groupHandins(folderNames: string[]): GroupedHandins {
  const byId = new Map<string, Handin>();
  const unrecognised: string[] = [];
  for (const folderName of folderNames) {
    const parsed = parseMoodleHandinFolder(folderName);
    if (!parsed.ok) {
      unrecognised.push(folderName);
      continue;
    }
    const { moodleId, fullName } = parsed.value;
    const existing = byId.get(moodleId);
    if (!existing) {
      byId.set(moodleId, {
        moodleId,
        fullName,
        alternativeNames: [],
        folders: [folderName],
      });
      continue;
    }
    existing.folders.push(folderName);
    if (
      fullName !== existing.fullName &&
      !existing.alternativeNames.includes(fullName)
    ) {
      existing.alternativeNames.push(fullName);
    }
  }
  return { handins: [...byId.values()], unrecognised };
}
