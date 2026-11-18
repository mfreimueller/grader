import type { PreflightEntryDto } from '../../../src/shared/gradeflow-api';
import {
  fileKey,
  groupPreflight,
  hasPersonalDataRisk,
  toExcludedFiles,
} from '../../../src/renderer/utils/gradeflowPreflight';

const entry = (o: Partial<PreflightEntryDto> = {}): PreflightEntryDto => ({
  studentId: 's1',
  path: 'Main.java',
  kind: 'text',
  replacements: 0,
  loneNameHits: [],
  detail: null,
  ...o,
});

const names: Record<string, string> = { s1: 'Bauer Anna', s2: 'Muster Max' };
const nameOf = (id: string): string => names[id] ?? '?';

describe('groupPreflight', () => {
  it('groups by student, ordered by name, files by path', () => {
    const groups = groupPreflight(
      [entry({ studentId: 's2', path: 'a.txt' }), entry({ path: 'z.txt' }), entry({ path: 'b.txt' })],
      nameOf,
    );

    expect(groups.map((g) => [g.studentId, g.name, g.files.map((f) => f.path)])).toEqual([
      ['s1', 'Bauer Anna', ['b.txt', 'z.txt']],
      ['s2', 'Muster Max', ['a.txt']],
    ]);
  });

  it('counts what happened to the files of a student', () => {
    const [group] = groupPreflight(
      [
        entry({ path: 'a', replacements: 2 }),
        entry({ path: 'b', replacements: 1, loneNameHits: [{ name: 'Anna', count: 3 }] }),
        entry({ path: 'c', kind: 'binary' }),
        entry({ path: 'd', kind: 'too-large' }),
        entry({ path: 'e', kind: 'skipped' }),
        entry({ path: 'f', kind: 'archive-error' }),
        entry({ path: 'g', kind: 'unsupported-archive' }),
        entry({ path: 'h', kind: 'symlink' }),
        entry({ path: 'i', kind: 'nested-archive' }),
        entry({ path: 'j', detail: 'converted from windows-1252' }),
      ],
      nameOf,
    );

    expect(group?.totals).toEqual({
      replacements: 3,
      loneNameFiles: 1,
      binary: 1,
      tooLarge: 1,
      skipped: 1,
      archiveErrors: 1,
      unsupportedArchives: 1,
      symlinks: 1,
      nestedArchives: 1,
      converted: 1,
    });
  });

  it('labels the kind of a file in German and keeps the lone-name hits for display', () => {
    const [group] = groupPreflight([entry({ kind: 'too-large' }), entry({ path: 'x', loneNameHits: [{ name: 'Anna', count: 2 }] })], nameOf);

    expect(group?.files[0]?.kindLabel).toBe('Zu groß, nicht übernommen');
    expect(group?.files[1]?.loneNameHits).toEqual([{ name: 'Anna', count: 2 }]);
  });

  it('lets only files in the workspace be excluded', () => {
    const [group] = groupPreflight(
      [entry({ path: 'a' }), entry({ path: 'b', kind: 'binary' }), entry({ path: 'c', kind: 'skipped' }), entry({ path: 'd', kind: 'too-large' })],
      nameOf,
    );

    expect(group?.files.map((f) => [f.path, f.excludable])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
      ['d', false],
    ]);
  });
});

describe('toExcludedFiles', () => {
  it('turns the chosen keys into the files to remove', () => {
    const keys = new Set([fileKey('s1', 'a.txt'), fileKey('s2', 'dir/b.txt')]);

    expect(toExcludedFiles(keys, [entry({ path: 'a.txt' }), entry({ studentId: 's2', path: 'dir/b.txt' }), entry({ path: 'c.txt' })])).toEqual([
      { studentId: 's1', path: 'a.txt' },
      { studentId: 's2', path: 'dir/b.txt' },
    ]);
  });

  it('ignores keys of files that are not in the report', () => {
    expect(toExcludedFiles(new Set(['nope']), [entry()])).toEqual([]);
  });
});

describe('hasPersonalDataRisk', () => {
  it('is true for binaries and lone-name hits, false for plain text', () => {
    expect(hasPersonalDataRisk([entry({ kind: 'binary' })])).toBe(true);
    expect(hasPersonalDataRisk([entry({ loneNameHits: [{ name: 'Max', count: 1 }] })])).toBe(true);
    expect(hasPersonalDataRisk([entry({ replacements: 4 })])).toBe(false);
    expect(hasPersonalDataRisk([])).toBe(false);
  });
});
