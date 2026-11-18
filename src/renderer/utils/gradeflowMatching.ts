// Second wizard step: which student a Moodle hand-in belongs to.

import type { HandinEntryDto, MatchOverride, PreparedRunDto } from '../../shared/gradeflow-api';

type PreparedStudent = PreparedRunDto['students'][number];

export interface MatchRow {
  moodleId: string;
  fullName: string;
  alternativeNames: string[];
  status: HandinEntryDto['status'];
  candidateIds: string[];
  /** What the backend proposed; a row only counts as changed when it differs from this. */
  baseline: string | null;
  selected: string | null;
}

export interface StudentOption {
  id: string;
  label: string;
  candidate: boolean;
}

export function buildMatchRows(prepared: PreparedRunDto): MatchRow[] {
  return prepared.entries.map((e) => ({
    moodleId: e.moodleId,
    fullName: e.fullName,
    alternativeNames: [...e.alternativeNames],
    status: e.status,
    candidateIds: [...e.candidateIds],
    baseline: e.studentId,
    selected: e.studentId,
  }));
}

export const studentLabel = (students: PreparedStudent[], id: string): string => {
  const student = students.find((s) => s.id === id);
  return student ? `${student.lastName} ${student.firstName}` : 'Unbekannt';
};

const byName = (a: PreparedStudent, b: PreparedStudent): number =>
  a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de');

/** Every student of the course, the candidates of the hand-in first. */
export function studentOptions(row: MatchRow, students: PreparedStudent[]): StudentOption[] {
  const candidates = students.filter((s) => row.candidateIds.includes(s.id));
  const others = students.filter((s) => !row.candidateIds.includes(s.id));
  const option = (candidate: boolean) => (s: PreparedStudent): StudentOption => ({
    id: s.id,
    label: `${s.lastName} ${s.firstName}`,
    candidate,
  });
  return [...candidates.sort(byName).map(option(true)), ...others.sort(byName).map(option(false))];
}

/** Every changed row; null means the hand-in is skipped. */
export function toOverrides(rows: MatchRow[]): MatchOverride[] {
  return rows
    .filter((r) => r.selected !== r.baseline)
    .map((r) => ({ moodleId: r.moodleId, studentId: r.selected }));
}

/** Students that more than one hand-in is assigned to; the backend would refuse that. */
export function duplicateAssignments(rows: MatchRow[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { selected } of rows) {
    if (selected === null) continue;
    if (seen.has(selected)) duplicates.add(selected);
    seen.add(selected);
  }
  return [...duplicates];
}
