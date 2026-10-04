import { cellMenu, columnMenu, type MenuEntry } from '../../../src/renderer/utils/sessionGridMenu';
import type { GridCell } from '../../../src/renderer/utils/sessionGridModel';

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

  it('labels the entries in German', () => {
    const labels = cellMenu(aCell({ hasNote: true, noteText: 'x' })).map((e) => e.label);
    expect(labels).toEqual(['Notiz bearbeiten', 'Notiz löschen', 'Ergebnis zurücksetzen']);
    expect(cellMenu(aCell())[0]!.label).toBe('Notiz hinzufügen');
    expect(cellMenu(aCell({ isImpromptu: true }))[1]!.label).toBe('Leistung löschen');
  });
});

describe('columnMenu', () => {
  it('only offers deleting the assessment for everybody', () => {
    const entries = columnMenu();
    expect(summary(entries)).toEqual(['delete-column:danger']);
    expect(entries[0]!.label).toBe('Leistung für alle löschen');
  });
});
