import {
  codeLines,
  describeExercise,
  describeHandin,
  describeSendSummary,
  filterExercises,
  missingJideFields,
  strayComments,
} from '../../../src/renderer/utils/gradeflowJide';
import type { ReviewJide } from '../../../src/renderer/utils/gradeflowReview';

const exercises = [
  { id: '1', slug: 'summe', title: 'Summe zweier Zahlen' },
  { id: '2', slug: 'fakultaet', title: 'Fakultät berechnen' },
  { id: '3', slug: 'liste-sortieren', title: 'Eine Liste sortieren' },
];

describe('exercise choice', () => {
  it('shows title and slug', () => {
    expect(describeExercise(exercises[0]!)).toBe('Summe zweier Zahlen (summe)');
  });

  it('finds by title or slug, every word, ignoring case', () => {
    expect(filterExercises(exercises, 'SUMME').map((e) => e.id)).toEqual(['1']);
    expect(filterExercises(exercises, 'liste sort').map((e) => e.id)).toEqual(['3']);
    expect(filterExercises(exercises, 'zahlen summe').map((e) => e.id)).toEqual(['1']);
    expect(filterExercises(exercises, 'nichts')).toEqual([]);
  });

  it('offers everything for an empty query', () => {
    expect(filterExercises(exercises, '  ')).toHaveLength(3);
  });
});

describe('missingJideFields', () => {
  it('names what is open, link first', () => {
    expect(missingJideFields({ assessmentId: '', jideExerciseId: '', skillId: '' }, false)).toEqual([
      'J;DE-Verknüpfung',
      'Leistung',
      'J;DE-Aufgabe',
      'Bewertungs-Skill',
    ]);
    expect(missingJideFields({ assessmentId: 'a', jideExerciseId: '1', skillId: 's' }, true)).toEqual([]);
  });
});

const jide = (patch: Partial<ReviewJide> = {}): ReviewJide => ({
  files: [{ path: 'Main.java', content: 'a\nb\nc\n' }],
  lineComments: [],
  submittedAt: '2026-11-10T12:00:00Z',
  late: false,
  testsPassed: 2,
  testsTotal: 3,
  graded: false,
  status: 'pending',
  message: null,
  ...patch,
});

describe('codeLines', () => {
  it('numbers the lines without counting the final line break', () => {
    expect(codeLines('a\nb\n', 'Main.java', []).map((l) => [l.number, l.text])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
    expect(codeLines('a\r\nb', 'Main.java', [])).toHaveLength(2);
    expect(codeLines('', 'Main.java', [])).toEqual([]);
  });

  it('attaches the very comment objects of that file and line', () => {
    const mine = { path: 'Main.java', line: 2, text: 'x' };
    const other = { path: 'Other.java', line: 2, text: 'y' };
    const lines = codeLines('a\nb\n', 'Main.java', [mine, other]);
    expect(lines[0]?.comments).toEqual([]);
    expect(lines[1]?.comments[0]).toBe(mine);
  });
});

describe('strayComments', () => {
  it('finds comments the code view cannot show', () => {
    const ok = { path: 'Main.java', line: 3, text: 'a' };
    const noFile = { path: 'Nope.java', line: 1, text: 'b' };
    const noLine = { path: 'Main.java', line: 4, text: 'c' };
    expect(strayComments(jide({ lineComments: [ok, noFile, noLine] }))).toEqual([noFile, noLine]);
  });
});

describe('describeHandin', () => {
  it('tells date, lateness, tests and an earlier grade', () => {
    expect(describeHandin(jide({ late: true, graded: true }))).toBe(
      'Abgegeben am 10.11.2026, verspätet, Tests 2 von 3 bestanden, in J;DE schon bewertet, wird ersetzt',
    );
  });

  it('leaves out what is not known', () => {
    expect(describeHandin(jide({ submittedAt: null, testsPassed: null, testsTotal: null }))).toBe('');
    expect(describeHandin(jide({ submittedAt: 'kaputt', testsPassed: null }))).toBe('');
  });
});

describe('describeSendSummary', () => {
  it('names each kind that occurred', () => {
    expect(describeSendSummary({ sent: 2, newerHandin: 1, failed: 1 })).toBe(
      '2 an J;DE gesendet, 1 nicht gesendet (neue Abgabe seit dem Laden), 1 nicht gesendet (Fehler)',
    );
    expect(describeSendSummary({ sent: 0, newerHandin: 0, failed: 0 })).toBe('');
  });
});
