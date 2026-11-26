import type { GridColumn } from '../../../src/renderer/utils/sessionGridModel';
import { categoryChoices, cellMenu, columnMenu, type MenuEntry } from '../../../src/renderer/utils/sessionGridMenu';
import type { GridCell } from '../../../src/renderer/utils/sessionGridModel';
import type { AssessmentCategoryDto } from '../../../src/shared/types';

const aCell = (o: Partial<GridCell> = {}): GridCell => ({
  key: 's-1:a-1',
  studentId: 's-1',
  assessmentId: 'a-1',
  performanceId: 'p-1',
  kind: 'symbol',
  symbol: 'PLUS',
  points: null,
  maxPoints: null,
  gradingType: 'TERTIARY',
  title: 'Mündlich',
  categoryTitle: 'Mitarbeit',
  isImpromptu: false,
  isMitarbeit: false,
  isDraft: false,
  canHaveNote: true,
  hasNote: false,
  noteText: null,
  locked: false,
  ...o,
});

const summary = (entries: MenuEntry<string>[]) =>
  entries.map((e) => `${e.action}${e.disabled ? ':disabled' : ''}${e.danger ? ':danger' : ''}${e.separatorBefore ? ':sep' : ''}`);

describe('cellMenu', () => {
  it('has no menu for a locked cell of an absent student', () => {
    expect(cellMenu(aCell({ locked: true }))).toEqual([]);
  });

  it('offers a note and the reset for a graded shared cell without a note', () => {
    expect(summary(cellMenu(aCell()))).toEqual(['note-add', 'reset-result:sep']);
  });

  it('offers to edit or delete an existing note', () => {
    expect(summary(cellMenu(aCell({ hasNote: true, noteText: 'x' })))).toEqual(['note-edit', 'note-delete', 'reset-result:sep']);
  });

  it('offers deleting an impromptu cell instead of resetting it', () => {
    expect(summary(cellMenu(aCell({ isImpromptu: true })))).toEqual(['note-add', 'delete-impromptu:danger:sep']);
    expect(summary(cellMenu(aCell({ isImpromptu: true, hasNote: true, noteText: 'x' })))).toEqual([
      'note-edit',
      'note-delete',
      'delete-impromptu:danger:sep',
    ]);
  });

  it('disables the note and the reset on an empty shared cell', () => {
    const empty = aCell({ kind: 'empty', symbol: null, performanceId: null, canHaveNote: false });
    expect(summary(cellMenu(empty))).toEqual(['note-add:disabled', 'reset-result:disabled:sep']);
  });

  it('keeps deleting possible for an impromptu cell that is not graded', () => {
    const empty = aCell({ kind: 'empty', symbol: null, isImpromptu: true, canHaveNote: false });
    expect(summary(cellMenu(empty))).toEqual(['note-add:disabled', 'delete-impromptu:danger:sep']);
  });

  it('still lets a leftover note on an ungraded cell be edited or deleted', () => {
    const leftover = aCell({ kind: 'empty', symbol: null, canHaveNote: false, hasNote: true, noteText: 'alt' });
    expect(summary(cellMenu(leftover))).toEqual(['note-edit', 'note-delete', 'reset-result:disabled:sep']);
  });

  it('has no menu for the Mitarbeit draft, which holds no result yet', () => {
    const draft = aCell({ kind: 'empty', symbol: null, performanceId: null, canHaveNote: false, isMitarbeit: true, isDraft: true });
    expect(cellMenu(draft)).toEqual([]);
  });

  it('offers notes and deleting on a recorded Mitarbeit', () => {
    expect(summary(cellMenu(aCell({ isImpromptu: true, isMitarbeit: true })))).toEqual(['note-add', 'delete-impromptu:danger:sep']);
  });

  it('labels the entries in German', () => {
    const labels = cellMenu(aCell({ hasNote: true, noteText: 'x' })).map((e) => e.label);
    expect(labels).toEqual(['Notiz bearbeiten', 'Notiz löschen', 'Ergebnis zurücksetzen']);
    expect(cellMenu(aCell())[0]!.label).toBe('Notiz hinzufügen');
    expect(cellMenu(aCell({ isImpromptu: true }))[1]!.label).toBe('Leistung löschen');
  });
});

const aCategory = (id: string, gradingType: 'TERTIARY' | 'NUMERIC', title = id): AssessmentCategoryDto => ({
  id,
  title,
  gradingType,
  displayAsGrade: false,
  courseId: 'course-1',
});

const aColumn = (gradingType: 'TERTIARY' | 'NUMERIC' = 'NUMERIC', categoryId = 'c-num'): GridColumn => ({
  assessmentId: 'a1',
  title: 'Test',
  categoryId,
  categoryTitle: 'Tests',
  gradingType,
  maxPoints: gradingType === 'NUMERIC' ? 10 : null,
});

describe('categoryChoices', () => {
  const categories = [
    aCategory('c-num', 'NUMERIC'),
    aCategory('c-num-2', 'NUMERIC'),
    aCategory('c-ter', 'TERTIARY'),
  ];

  it('offers the categories with the grading type of the column, the current one included', () => {
    expect(categoryChoices(aColumn('NUMERIC', 'c-num'), categories).map((c) => c.id)).toEqual(['c-num', 'c-num-2']);
  });

  it('never offers a category of the other grading type', () => {
    expect(categoryChoices(aColumn('TERTIARY', 'c-ter'), categories).map((c) => c.id)).toEqual(['c-ter']);
  });

  it('offers nothing when there are no categories', () => {
    expect(categoryChoices(aColumn(), [])).toEqual([]);
  });
});

describe('columnMenu', () => {
  const categories = [aCategory('c-num', 'NUMERIC'), aCategory('c-num-2', 'NUMERIC'), aCategory('c-ter', 'TERTIARY')];

  it('offers Gradeflow and changing the category before deleting the assessment for everybody', () => {
    const entries = columnMenu(aColumn(), categories);

    expect(summary(entries)).toEqual(['gradeflow', 'change-category', 'delete-column:danger:sep']);
    expect(entries.map((e) => e.label)).toEqual(['Mit Gradeflow bewerten…', 'Art ändern…', 'Leistung für alle löschen']);
  });

  it('offers Gradeflow for symbol columns as well', () => {
    const entries = columnMenu(aColumn('TERTIARY', 'c-ter'), categories);
    expect(entries.map((e) => e.action)).toEqual(['gradeflow', 'change-category', 'delete-column']);
  });

  it('disables changing the category when no other category has the grading type', () => {
    expect(summary(columnMenu(aColumn('TERTIARY', 'c-ter'), categories))).toEqual([
      'gradeflow',
      'change-category:disabled',
      'delete-column:danger:sep',
    ]);
  });
});
