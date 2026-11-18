// Which entries the context menus of the session grid offer, as pure functions.

import { gradeflowColumnEligible } from './gradeflowRoute';
import type { GridCell, GridColumn } from './sessionGridModel';

export type CellMenuAction = 'note-add' | 'note-edit' | 'note-delete' | 'reset-result' | 'delete-impromptu';
export type ColumnMenuAction = 'gradeflow' | 'delete-column';

export interface MenuEntry<A extends string> {
  action: A;
  label: string;
  disabled: boolean;
  danger: boolean;
  separatorBefore: boolean;
}

const entry = <A extends string>(action: A, label: string, o: Partial<Omit<MenuEntry<A>, 'action' | 'label'>> = {}): MenuEntry<A> => ({
  action,
  label,
  disabled: false,
  danger: false,
  separatorBefore: false,
  ...o,
});

/**
 * Menu of a result cell. A note hangs on a result, so a cell without one cannot get a note; an impromptu cell is
 * its own assessment and is deleted as a whole, while a shared cell can only have this student's result reset.
 * The Mitarbeit draft has no menu: it is not saved yet.
 */
export function cellMenu(cell: GridCell): MenuEntry<CellMenuAction>[] {
  if (cell.locked || cell.isDraft) return [];
  const note: MenuEntry<CellMenuAction>[] = cell.hasNote
    ? [entry('note-edit', 'Notiz bearbeiten'), entry('note-delete', 'Notiz löschen')]
    : [entry('note-add', 'Notiz hinzufügen', { disabled: !cell.canHaveNote })];
  const remove = cell.isImpromptu
    ? entry('delete-impromptu', 'Leistung löschen', { danger: true, separatorBefore: true })
    : entry('reset-result', 'Ergebnis zurücksetzen', { disabled: cell.kind === 'empty', separatorBefore: true });
  return [...note, remove];
}

/** Gradeflow proposes symbols or points for a whole assessment, so it is offered on shared columns of those types. */
export function columnMenu(column: GridColumn): MenuEntry<ColumnMenuAction>[] {
  const gradeflow = gradeflowColumnEligible(column.gradingType) ? [entry('gradeflow', 'Mit Gradeflow bewerten…')] : [];
  return [
    ...gradeflow,
    entry('delete-column', 'Leistung für alle löschen', { danger: true, separatorBefore: gradeflow.length > 0 }),
  ];
}
