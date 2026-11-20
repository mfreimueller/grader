// Pure rules of the J;DE linking panel: which J;DE person a student is shown with, and what is saved.

import type { JideLinkOverviewDto, JideSaveLinksInput } from '../../shared/jide-api';

export interface LinkRow {
  studentId: string;
  label: string;
  /** The J;DE person id chosen in the row; '' means not linked. */
  selected: string;
  /** The choice is only a name-based proposal the teacher has not saved yet. */
  suggested: boolean;
}

export const linkLabel = (s: { firstName: string; lastName: string }): string => `${s.lastName} ${s.firstName}`;

/** A saved link wins over a proposal; a student with neither stays unlinked. */
export function buildLinkRows(overview: JideLinkOverviewDto): LinkRow[] {
  return overview.students
    .map((s) => {
      const confirmed = s.jideStudentId;
      const proposal = confirmed === null ? s.suggestedJideStudentId : null;
      return {
        studentId: s.studentId,
        label: linkLabel(s),
        selected: confirmed ?? proposal ?? '',
        suggested: proposal !== null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

/** The names of the students whose chosen J;DE person is also chosen for another student. */
export function duplicateLinks(rows: LinkRow[]): string[] {
  const owners = new Map<string, LinkRow[]>();
  for (const row of rows) {
    if (row.selected !== '') owners.set(row.selected, [...(owners.get(row.selected) ?? []), row]);
  }
  return [...owners.values()].filter((group) => group.length > 1).flatMap((group) => group.map((r) => r.label));
}

export function toSaveLinks(courseId: string, jideCourseId: string, rows: LinkRow[]): JideSaveLinksInput {
  return {
    courseId,
    jideCourseId: jideCourseId === '' ? null : jideCourseId,
    links: rows.map((r) => ({ studentId: r.studentId, jideStudentId: r.selected === '' ? null : r.selected })),
  };
}

export const describeJideCourse = (c: { subject: string; className: string }): string => `${c.subject} · ${c.className}`;
