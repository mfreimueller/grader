// Keyboard navigation of the session grid as pure functions. The grid is one tab stop (roving tabindex);
// arrow keys move between positions. Row -1 is the header row: the shared column headers followed by the
// header add cell. Body rows hold the shared cells, the row's own impromptu cells and a trailing add cell, so
// rows can have different lengths.

import type { GridCell, GridColumn, GridRow, SessionGridModel } from './sessionGridModel';

export interface GridPosition {
  row: number;
  col: number;
}

export interface GridShape {
  sharedCount: number;
  /** Number of impromptu cells per body row. */
  impromptuCounts: readonly number[];
}

export interface Navigation {
  position: GridPosition;
  /** The column to return to when moving through shorter rows (like a text cursor). */
  preferredCol: number;
}

export type NavigationTarget =
  | { type: 'column-header'; column: GridColumn }
  | { type: 'header-add' }
  | { type: 'cell'; cell: GridCell }
  | { type: 'row-add'; row: GridRow };

const HEADER_ROW = -1;

export function shapeOf(model: SessionGridModel): GridShape {
  return { sharedCount: model.columns.length, impromptuCounts: model.rows.map((r) => r.impromptuCells.length) };
}

export function rowLength(shape: GridShape, row: number): number {
  if (row === HEADER_ROW) return shape.sharedCount + 1;
  return shape.sharedCount + (shape.impromptuCounts[row] ?? 0) + 1;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function clampPosition(shape: GridShape, position: GridPosition): GridPosition {
  const row = clamp(position.row, HEADER_ROW, shape.impromptuCounts.length - 1);
  return { row, col: clamp(position.col, 0, rowLength(shape, row) - 1) };
}

export function navigate(shape: GridShape, from: Navigation, key: string, ctrl: boolean): Navigation {
  const { row, col } = from.position;
  const lastRow = shape.impromptuCounts.length - 1;
  const horizontal = (newCol: number): Navigation => ({ position: { row, col: newCol }, preferredCol: newCol });
  const vertical = (newRow: number): Navigation => {
    const target = clamp(newRow, HEADER_ROW, lastRow);
    return { position: { row: target, col: Math.min(from.preferredCol, rowLength(shape, target) - 1) }, preferredCol: from.preferredCol };
  };

  switch (key) {
    case 'ArrowLeft':
      return horizontal(Math.max(0, col - 1));
    case 'ArrowRight':
      return horizontal(Math.min(rowLength(shape, row) - 1, col + 1));
    case 'ArrowUp':
      return vertical(row - 1);
    case 'ArrowDown':
      return vertical(row + 1);
    case 'Home':
      if (ctrl) return { position: { row: lastRow >= 0 ? 0 : HEADER_ROW, col: 0 }, preferredCol: 0 };
      return horizontal(0);
    case 'End':
      if (ctrl) {
        const endRow = lastRow >= 0 ? lastRow : HEADER_ROW;
        const endCol = rowLength(shape, endRow) - 1;
        return { position: { row: endRow, col: endCol }, preferredCol: endCol };
      }
      return horizontal(rowLength(shape, row) - 1);
    default:
      return from;
  }
}

export function targetAt(model: SessionGridModel, position: GridPosition): NavigationTarget | null {
  const { row, col } = position;
  const sharedCount = model.columns.length;
  if (col < 0) return null;

  if (row === HEADER_ROW) {
    const column = model.columns[col];
    if (column) return { type: 'column-header', column };
    return col === sharedCount ? { type: 'header-add' } : null;
  }

  const bodyRow = model.rows[row];
  if (!bodyRow) return null;
  const cell = col < sharedCount ? bodyRow.sharedCells[col] : bodyRow.impromptuCells[col - sharedCount];
  if (cell) return { type: 'cell', cell };
  return col === sharedCount + bodyRow.impromptuCells.length ? { type: 'row-add', row: bodyRow } : null;
}
