import {
  clampPosition,
  navigate,
  rowLength,
  shapeOf,
  targetAt,
  type GridShape,
  type Navigation,
} from '../../../src/renderer/utils/sessionGridNavigation';
import type { GridCell, GridColumn, GridRow, SessionGridModel } from '../../../src/renderer/utils/sessionGridModel';

// 2 shared columns; rows have 1, 0 and 2 impromptu cells.
// Header row:  [col0] [col1] [+]                         -> 3 positions
// Row 0:       [s0]   [s1]   [i0]  [+]                   -> 4 positions
// Row 1:       [s0]   [s1]   [+]                         -> 3 positions
// Row 2:       [s0]   [s1]   [i0]  [i1]  [+]             -> 5 positions
const shape: GridShape = { sharedCount: 2, impromptuCounts: [1, 0, 2] };

const at = (row: number, col: number, preferredCol = col): Navigation => ({ position: { row, col }, preferredCol });
const press = (from: Navigation, key: string, ctrl = false, s: GridShape = shape): Navigation => navigate(s, from, key, ctrl);

describe('rowLength', () => {
  it('counts shared cells, impromptu cells and the trailing add cell', () => {
    expect(rowLength(shape, 0)).toBe(4);
    expect(rowLength(shape, 1)).toBe(3);
    expect(rowLength(shape, 2)).toBe(5);
  });

  it('counts the column headers plus the header add cell for the header row', () => {
    expect(rowLength(shape, -1)).toBe(3);
  });

  it('treats a row that does not exist as having no impromptu cells', () => {
    expect(rowLength(shape, 9)).toBe(3);
  });
});

describe('navigate', () => {
  describe('horizontal', () => {
    it('moves right and left', () => {
      expect(press(at(0, 0), 'ArrowRight').position).toEqual({ row: 0, col: 1 });
      expect(press(at(0, 2), 'ArrowLeft').position).toEqual({ row: 0, col: 1 });
    });

    it('stops at the first and the last position of the row', () => {
      expect(press(at(0, 0), 'ArrowLeft').position).toEqual({ row: 0, col: 0 });
      expect(press(at(0, 3), 'ArrowRight').position).toEqual({ row: 0, col: 3 });
      expect(press(at(1, 2), 'ArrowRight').position).toEqual({ row: 1, col: 2 });
    });

    it('reaches the add cell at the end of a row', () => {
      expect(press(at(2, 3), 'ArrowRight').position).toEqual({ row: 2, col: 4 });
    });

    it('resets the preferred column to where it ended up', () => {
      expect(press(at(2, 4), 'ArrowLeft').preferredCol).toBe(3);
      expect(press(at(0, 3), 'ArrowRight').preferredCol).toBe(3);
    });
  });

  describe('vertical', () => {
    it('moves down and up inside the same column', () => {
      expect(press(at(0, 1), 'ArrowDown').position).toEqual({ row: 1, col: 1 });
      expect(press(at(1, 1), 'ArrowUp').position).toEqual({ row: 0, col: 1 });
    });

    it('goes from the header into the first row and back', () => {
      expect(press(at(-1, 0), 'ArrowDown').position).toEqual({ row: 0, col: 0 });
      expect(press(at(0, 0), 'ArrowUp').position).toEqual({ row: -1, col: 0 });
    });

    it('lines the header add cell up with the first cell behind the shared columns', () => {
      expect(press(at(-1, 2), 'ArrowDown').position).toEqual({ row: 0, col: 2 });
      expect(press(at(0, 2), 'ArrowUp').position).toEqual({ row: -1, col: 2 });
    });

    it('stays on the first row of the header and on the last row of the body', () => {
      expect(press(at(-1, 1), 'ArrowUp').position).toEqual({ row: -1, col: 1 });
      expect(press(at(2, 1), 'ArrowDown').position).toEqual({ row: 2, col: 1 });
    });

    it('clamps the column when the next row is shorter', () => {
      expect(press(at(0, 3), 'ArrowDown').position).toEqual({ row: 1, col: 2 });
      expect(press(at(0, 3), 'ArrowUp').position).toEqual({ row: -1, col: 2 });
    });

    it('remembers the preferred column across short rows', () => {
      const shorter = press(at(0, 3), 'ArrowDown');
      expect(shorter.position).toEqual({ row: 1, col: 2 });
      expect(shorter.preferredCol).toBe(3);
      expect(press(shorter, 'ArrowDown').position).toEqual({ row: 2, col: 3 });
    });

    it('uses the preferred column again when the row is long enough', () => {
      const from = at(1, 2, 4);
      expect(press(from, 'ArrowDown').position).toEqual({ row: 2, col: 4 });
    });
  });

  describe('home and end', () => {
    it('jumps to the first and last position of the row', () => {
      expect(press(at(2, 2), 'Home').position).toEqual({ row: 2, col: 0 });
      expect(press(at(2, 2), 'End').position).toEqual({ row: 2, col: 4 });
      expect(press(at(-1, 1), 'End').position).toEqual({ row: -1, col: 2 });
    });

    it('updates the preferred column', () => {
      expect(press(at(2, 2), 'End').preferredCol).toBe(4);
      expect(press(at(2, 2), 'Home').preferredCol).toBe(0);
    });

    it('jumps to the very first body cell and the very last position with Ctrl', () => {
      expect(press(at(2, 3), 'Home', true).position).toEqual({ row: 0, col: 0 });
      expect(press(at(0, 0), 'End', true).position).toEqual({ row: 2, col: 4 });
    });
  });

  describe('edge cases', () => {
    it('ignores keys that are not navigation keys', () => {
      const from = at(1, 1);
      expect(press(from, 'a')).toEqual(from);
      expect(press(from, 'Enter')).toEqual(from);
      expect(press(from, 'Tab')).toEqual(from);
    });

    it('stays in the header when there are no rows', () => {
      const empty: GridShape = { sharedCount: 2, impromptuCounts: [] };
      expect(navigate(empty, at(-1, 1), 'ArrowDown', false).position).toEqual({ row: -1, col: 1 });
      expect(navigate(empty, at(-1, 1), 'Home', true).position).toEqual({ row: -1, col: 0 });
      expect(navigate(empty, at(-1, 0), 'End', true).position).toEqual({ row: -1, col: 2 });
    });

    it('works without shared columns', () => {
      const none: GridShape = { sharedCount: 0, impromptuCounts: [0, 1] };
      expect(rowLength(none, -1)).toBe(1);
      expect(navigate(none, at(-1, 0), 'ArrowDown', false).position).toEqual({ row: 0, col: 0 });
      expect(navigate(none, at(1, 0), 'ArrowRight', false).position).toEqual({ row: 1, col: 1 });
    });
  });
});

describe('clampPosition', () => {
  it('keeps a valid position', () => {
    expect(clampPosition(shape, { row: 1, col: 2 })).toEqual({ row: 1, col: 2 });
  });

  it('pulls a row beyond the last one back to the last row', () => {
    expect(clampPosition(shape, { row: 7, col: 0 })).toEqual({ row: 2, col: 0 });
  });

  it('pulls a column beyond the row end back to its last position', () => {
    expect(clampPosition(shape, { row: 1, col: 9 })).toEqual({ row: 1, col: 2 });
  });

  it('never goes above the header or left of the first column', () => {
    expect(clampPosition(shape, { row: -5, col: -3 })).toEqual({ row: -1, col: 0 });
  });

  it('falls back to the header when there are no rows', () => {
    expect(clampPosition({ sharedCount: 2, impromptuCounts: [] }, { row: 0, col: 1 })).toEqual({ row: -1, col: 1 });
  });
});

describe('model based lookup', () => {
  const cell = (studentId: string, assessmentId: string, isImpromptu = false): GridCell => ({
    key: `${studentId}:${assessmentId}`,
    studentId,
    assessmentId,
    performanceId: null,
    kind: 'empty',
    symbol: null,
    points: null,
    maxPoints: null,
    gradingType: 'TERTIARY',
    title: assessmentId,
    categoryTitle: 'Mitarbeit',
    isImpromptu,
    canHaveNote: false,
    hasNote: false,
    noteText: null,
    locked: false,
  });
  const column = (id: string): GridColumn => ({ assessmentId: id, title: id, categoryTitle: 'Mitarbeit', gradingType: 'TERTIARY', maxPoints: null });
  const row = (studentId: string, impromptu: string[]): GridRow => ({
    studentId,
    displayName: studentId,
    absent: false,
    sharedCells: [cell(studentId, 'a-1'), cell(studentId, 'a-2')],
    impromptuCells: impromptu.map((i) => cell(studentId, i, true)),
  });
  const model: SessionGridModel = { columns: [column('a-1'), column('a-2')], rows: [row('s-1', ['i-1']), row('s-2', [])] };

  it('derives the shape from the model', () => {
    expect(shapeOf(model)).toEqual({ sharedCount: 2, impromptuCounts: [1, 0] });
  });

  it('finds column headers and the header add cell', () => {
    expect(targetAt(model, { row: -1, col: 1 })).toEqual({ type: 'column-header', column: model.columns[1] });
    expect(targetAt(model, { row: -1, col: 2 })).toEqual({ type: 'header-add' });
  });

  it('finds shared and impromptu cells', () => {
    expect(targetAt(model, { row: 0, col: 1 })).toEqual({ type: 'cell', cell: model.rows[0]!.sharedCells[1] });
    expect(targetAt(model, { row: 0, col: 2 })).toEqual({ type: 'cell', cell: model.rows[0]!.impromptuCells[0] });
  });

  it('finds the add cell at the end of each row', () => {
    expect(targetAt(model, { row: 0, col: 3 })).toEqual({ type: 'row-add', row: model.rows[0] });
    expect(targetAt(model, { row: 1, col: 2 })).toEqual({ type: 'row-add', row: model.rows[1] });
  });

  it('returns null for positions outside the grid', () => {
    expect(targetAt(model, { row: 5, col: 0 })).toBeNull();
    expect(targetAt(model, { row: 0, col: 9 })).toBeNull();
    expect(targetAt(model, { row: -1, col: 9 })).toBeNull();
    expect(targetAt(model, { row: 0, col: -1 })).toBeNull();
  });
});
