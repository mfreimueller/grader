import type { PreparedRunDto } from '../../../src/shared/gradeflow-api';
import {
  buildMatchRows,
  duplicateAssignments,
  studentLabel,
  studentOptions,
  toOverrides,
} from '../../../src/renderer/utils/gradeflowMatching';

const prepared = (): PreparedRunDto => ({
  runId: 'r',
  entries: [
    { moodleId: '1', fullName: 'Anna Bauer', alternativeNames: [], status: 'matched', studentId: 's-anna', candidateIds: [] },
    { moodleId: '2', fullName: 'Max Muster', alternativeNames: [], status: 'ambiguous', studentId: null, candidateIds: ['s-max1', 's-max2'] },
    { moodleId: '3', fullName: 'Fremd Person', alternativeNames: [], status: 'unmatched', studentId: null, candidateIds: [] },
  ],
  unrecognised: ['komischer Ordner'],
  studentsWithoutHandin: ['s-zoe'],
  conflicts: [],
  students: [
    { id: 's-zoe', firstName: 'Zoe', lastName: 'Zorn' },
    { id: 's-anna', firstName: 'Anna', lastName: 'Bauer' },
    { id: 's-max2', firstName: 'Max', lastName: 'Muster' },
    { id: 's-max1', firstName: 'Maximilian', lastName: 'Muster' },
  ],
});

describe('buildMatchRows', () => {
  it('preselects matched hand-ins and leaves the others empty', () => {
    const rows = buildMatchRows(prepared());

    expect(rows.map((r) => [r.moodleId, r.status, r.selected])).toEqual([
      ['1', 'matched', 's-anna'],
      ['2', 'ambiguous', null],
      ['3', 'unmatched', null],
    ]);
  });
});

describe('studentOptions', () => {
  it('lists the candidates first, then everybody else by name', () => {
    const p = prepared();
    const row = buildMatchRows(p)[1]!;

    const options = studentOptions(row, p.students);

    expect(options.map((o) => [o.id, o.candidate])).toEqual([
      ['s-max2', true],
      ['s-max1', true],
      ['s-anna', false],
      ['s-zoe', false],
    ]);
    expect(options[0]?.label).toBe('Muster Max');
  });

  it('sorts by last name then first name when there are no candidates', () => {
    const p = prepared();

    expect(studentOptions(buildMatchRows(p)[2]!, p.students).map((o) => o.id)).toEqual(['s-anna', 's-max2', 's-max1', 's-zoe']);
  });
});

describe('studentLabel', () => {
  it('writes last name first and tolerates an unknown id', () => {
    expect(studentLabel(prepared().students, 's-anna')).toBe('Bauer Anna');
    expect(studentLabel(prepared().students, 'gone')).toBe('Unbekannt');
  });
});

describe('toOverrides', () => {
  it('sends nothing while the preselection is untouched', () => {
    expect(toOverrides(buildMatchRows(prepared()))).toEqual([]);
  });

  it('sends every changed row, null for a skipped hand-in', () => {
    const rows = buildMatchRows(prepared());
    rows[0]!.selected = null;
    rows[1]!.selected = 's-max1';

    expect(toOverrides(rows)).toEqual([
      { moodleId: '1', studentId: null },
      { moodleId: '2', studentId: 's-max1' },
    ]);
  });

  it('does not send a row that was changed and changed back', () => {
    const rows = buildMatchRows(prepared());
    rows[0]!.selected = 's-zoe';
    rows[0]!.selected = 's-anna';

    expect(toOverrides(rows)).toEqual([]);
  });
});

describe('duplicateAssignments', () => {
  it('names the students that two hand-ins are assigned to', () => {
    const rows = buildMatchRows(prepared());
    rows[1]!.selected = 's-anna';
    rows[2]!.selected = 's-anna';

    expect(duplicateAssignments(rows)).toEqual(['s-anna']);
  });

  it('is empty when every student has at most one hand-in', () => {
    expect(duplicateAssignments(buildMatchRows(prepared()))).toEqual([]);
  });
});
