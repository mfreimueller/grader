// Third wizard step: what the pseudonymised workspace contains and what could not be made anonymous.

import type { PreflightEntryDto, WorkspaceEntryKindDto } from '../../shared/gradeflow-api';

const KIND_LABELS: Readonly<Record<WorkspaceEntryKindDto, string>> = {
  text: 'Textdatei',
  binary: 'Binärdatei, kann Namen enthalten',
  skipped: 'Übersprungen',
  symlink: 'Symbolischer Link, nicht übernommen',
  'too-large': 'Zu groß, nicht übernommen',
  'nested-archive': 'Archiv im Archiv, nicht entpackt',
  'archive-error': 'Archiv konnte nicht gelesen werden',
  'unsupported-archive': 'Archivformat nicht unterstützt',
};

/** Only files that made it into the workspace can still be removed from it. */
const IN_WORKSPACE: ReadonlySet<WorkspaceEntryKindDto> = new Set(['text', 'binary']);

export interface PreflightFileView {
  key: string;
  studentId: string;
  path: string;
  kind: WorkspaceEntryKindDto;
  kindLabel: string;
  replacements: number;
  loneNameHits: { name: string; count: number }[];
  detail: string | null;
  excludable: boolean;
}

export interface PreflightTotals {
  replacements: number;
  loneNameFiles: number;
  binary: number;
  tooLarge: number;
  skipped: number;
  archiveErrors: number;
  unsupportedArchives: number;
  symlinks: number;
  nestedArchives: number;
  converted: number;
}

export interface PreflightGroup {
  studentId: string;
  name: string;
  files: PreflightFileView[];
  totals: PreflightTotals;
}

export const fileKey = (studentId: string, path: string): string => `${studentId}\u0000${path}`;

function totalsOf(files: PreflightFileView[]): PreflightTotals {
  const count = (kind: WorkspaceEntryKindDto): number => files.filter((f) => f.kind === kind).length;
  return {
    replacements: files.reduce((sum, f) => sum + f.replacements, 0),
    loneNameFiles: files.filter((f) => f.loneNameHits.length > 0).length,
    binary: count('binary'),
    tooLarge: count('too-large'),
    skipped: count('skipped'),
    archiveErrors: count('archive-error'),
    unsupportedArchives: count('unsupported-archive'),
    symlinks: count('symlink'),
    nestedArchives: count('nested-archive'),
    converted: files.filter((f) => f.detail?.startsWith('converted from')).length,
  };
}

export function groupPreflight(report: PreflightEntryDto[], nameOf: (studentId: string) => string): PreflightGroup[] {
  const byStudent = new Map<string, PreflightFileView[]>();
  for (const e of report) {
    const view: PreflightFileView = {
      key: fileKey(e.studentId, e.path),
      studentId: e.studentId,
      path: e.path,
      kind: e.kind,
      kindLabel: KIND_LABELS[e.kind],
      replacements: e.replacements,
      loneNameHits: e.loneNameHits.map((h) => ({ ...h })),
      detail: e.detail,
      excludable: IN_WORKSPACE.has(e.kind),
    };
    byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), view]);
  }
  return [...byStudent.entries()]
    .map(([studentId, files]) => ({
      studentId,
      name: nameOf(studentId),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      totals: totalsOf(files),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export function toExcludedFiles(keys: ReadonlySet<string>, report: PreflightEntryDto[]): { studentId: string; path: string }[] {
  return report.filter((e) => keys.has(fileKey(e.studentId, e.path))).map((e) => ({ studentId: e.studentId, path: e.path }));
}

/** Binaries and lone names may still hold personal data that was not replaced. */
export function hasPersonalDataRisk(report: PreflightEntryDto[]): boolean {
  return report.some((e) => e.kind === 'binary' || e.loneNameHits.length > 0);
}
