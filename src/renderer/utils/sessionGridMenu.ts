// Which entries the context menus of the session grid offer, as pure functions.

import type { GridCell } from './sessionGridModel';

export type CellMenuAction = 'note-add' | 'note-edit' | 'note-delete' | 'reset-result' | 'delete-impromptu';
export type ColumnMenuAction = 'delete-column';

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
 */
export function cellMenu(cell: GridCell): MenuEntry<CellMenuAction>[] {
  if (cell.locked) return [];
  const note: MenuEntry<CellMenuAction>[] = cell.hasNote
    ? [entry('note-edit', 'Notiz bearbeiten'), entry('note-delete', 'Notiz löschen')]
    : [entry('note-add', 'Notiz hinzufügen', { disabled: !cell.canHaveNote })];
  const remove = cell.isImpromptu
    ? entry('delete-impromptu', 'Leistung löschen', { danger: true, separatorBefore: true })
    : entry('reset-result', 'Ergebnis zurücksetzen', { disabled: cell.kind === 'empty', separatorBefore: true });
  return [...note, remove];
}

export function columnMenu(): MenuEntry<ColumnMenuAction>[] {
  return [entry('delete-column', 'Leistung für alle löschen', { danger: true })];
}
