// Which entries the context menus of the session grid offer, as pure functions.

import { gradeflowColumnEligible } from './gradeflowRoute';
import type { AssessmentCategoryDto } from '../../shared/types';
import type { GridCell, GridColumn } from './sessionGridModel';

export type CellMenuAction = 'note-add' | 'note-edit' | 'note-delete' | 'reset-result' | 'delete-impromptu';
export type ColumnMenuAction = 'gradeflow' | 'change-category' | 'delete-column';

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

/**
 * The categories a column can be moved to: those with its grading type, the current one included so a picker can
 * preselect it. Results of the other type would be meaningless (symbols versus points).
 */
export function categoryChoices(column: GridColumn, categories: readonly AssessmentCategoryDto[]): AssessmentCategoryDto[] {
  return categories.filter((c) => c.gradingType === column.gradingType);
}

/**
 * Gradeflow proposes symbols or points for a whole assessment, so it is offered on shared columns of those types.
 * Changing the category needs another category of the same grading type to move to.
 */
export function columnMenu(column: GridColumn, categories: readonly AssessmentCategoryDto[]): MenuEntry<ColumnMenuAction>[] {
  const gradeflow = gradeflowColumnEligible(column.gradingType) ? [entry('gradeflow', 'Mit Gradeflow bewerten…')] : [];
  const canMove = categoryChoices(column, categories).some((c) => c.id !== column.categoryId);
  return [
    ...gradeflow,
    entry('change-category', 'Art ändern…', { disabled: !canMove }),
    entry('delete-column', 'Leistung für alle löschen', { danger: true, separatorBefore: true }),
  ];
}
