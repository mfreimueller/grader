// Keyboard navigation of the session grid as pure functions. The grid is one tab stop (roving tabindex);
// arrow keys move between positions. Row -1 is the header row: the shared column headers followed by the
// header add cell. Body rows hold the shared cells, the Mitarbeit zone (results and the draft), the row's own
// impromptu cells and a trailing add cell. The Mitarbeit zone has the same width in every row so the impromptu
// zones line up; a row with fewer Mitarbeit results has a gap behind its draft that cannot be selected.

import type { GridCell, GridColumn, GridRow, SessionGridModel } from './sessionGridModel';

export interface GridPosition {
  row: number;
  col: number;
}

export interface GridShape {
  sharedCount: number;
  /** Columns the Mitarbeit zone spans in every body row. */
  mitarbeitWidth: number;
  /** Number of Mitarbeit results (without the draft) per body row. */
  mitarbeitCounts: readonly number[];
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
  return {
    sharedCount: model.columns.length,
    mitarbeitWidth: model.mitarbeitWidth,
    mitarbeitCounts: model.rows.map((r) => r.mitarbeitCells.length),
    impromptuCounts: model.rows.map((r) => r.impromptuCells.length),
  };
}

const range = (from: number, count: number): number[] => Array.from({ length: Math.max(0, count) }, (_, i) => from + i);

/** The columns of a row that can be selected, ascending. */
export function positionsOf(shape: GridShape, row: number): number[] {
  const { sharedCount, mitarbeitWidth } = shape;
  if (row === HEADER_ROW) return range(0, sharedCount + 1);
  const mitarbeit = Math.min((shape.mitarbeitCounts[row] ?? 0) + 1, mitarbeitWidth);
  return [
    ...range(0, sharedCount),
    ...range(sharedCount, mitarbeit),
    ...range(sharedCount + mitarbeitWidth, (shape.impromptuCounts[row] ?? 0) + 1),
  ];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** The last position at or left of the column, or the first position of the row. */
const snap = (positions: readonly number[], col: number): number =>
  positions.filter((p) => p <= col).pop() ?? positions[0] ?? 0;

export function clampPosition(shape: GridShape, position: GridPosition): GridPosition {
  const row = clamp(position.row, HEADER_ROW, shape.impromptuCounts.length - 1);
  return { row, col: snap(positionsOf(shape, row), position.col) };
}

export function navigate(shape: GridShape, from: Navigation, key: string, ctrl: boolean): Navigation {
  const { row, col } = from.position;
  const lastRow = shape.impromptuCounts.length - 1;
  const positions = positionsOf(shape, row);
  const first = positions[0] ?? 0;
  const last = positions[positions.length - 1] ?? 0;
  const horizontal = (newCol: number): Navigation => ({ position: { row, col: newCol }, preferredCol: newCol });
  const vertical = (newRow: number): Navigation => {
    const target = clamp(newRow, HEADER_ROW, lastRow);
    return { position: { row: target, col: snap(positionsOf(shape, target), from.preferredCol) }, preferredCol: from.preferredCol };
  };

  switch (key) {
    case 'ArrowLeft':
      return horizontal(positions.filter((p) => p < col).pop() ?? first);
    case 'ArrowRight':
      return horizontal(positions.find((p) => p > col) ?? last);
    case 'ArrowUp':
      return vertical(row - 1);
    case 'ArrowDown':
      return vertical(row + 1);
    case 'Home':
      if (ctrl) return { position: { row: lastRow >= 0 ? 0 : HEADER_ROW, col: 0 }, preferredCol: 0 };
      return horizontal(first);
    case 'End':
      if (ctrl) {
        const endRow = lastRow >= 0 ? lastRow : HEADER_ROW;
        const endCol = positionsOf(shape, endRow).pop() ?? 0;
        return { position: { row: endRow, col: endCol }, preferredCol: endCol };
      }
      return horizontal(last);
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
  if (col < sharedCount) {
    const cell = bodyRow.sharedCells[col];
    return cell ? { type: 'cell', cell } : null;
  }
  const impromptuStart = sharedCount + model.mitarbeitWidth;
  if (col < impromptuStart) {
    const k = col - sharedCount;
    const cell = k === bodyRow.mitarbeitCells.length ? bodyRow.mitarbeitDraft : bodyRow.mitarbeitCells[k];
    return cell ? { type: 'cell', cell } : null;
  }
  const cell = bodyRow.impromptuCells[col - impromptuStart];
  if (cell) return { type: 'cell', cell };
  return col === impromptuStart + bodyRow.impromptuCells.length ? { type: 'row-add', row: bodyRow } : null;
}
