import { cellAriaLabel, columnAriaLabel, symbolGlyph, symbolName, valueText } from '../../../src/renderer/utils/sessionGridLabels';
import type { GridCell, GridColumn } from '../../../src/renderer/utils/sessionGridModel';

const aCell = (o: Partial<GridCell> = {}): GridCell => ({
  key: 's-1:a-1',
  studentId: 's-1',
  assessmentId: 'a-1',
  performanceId: null,
  kind: 'empty',
  symbol: null,
  points: null,
  maxPoints: null,
  gradingType: 'TERTIARY',
  title: 'Mündlich',
  categoryTitle: 'Mitarbeit',
  isImpromptu: false,
  canHaveNote: false,
  hasNote: false,
  noteText: null,
  locked: false,
  ...o,
});

describe('symbolGlyph', () => {
  it('maps symbols to the characters shown in the grid', () => {
    expect(symbolGlyph('PLUS')).toBe('+');
    expect(symbolGlyph('WELLE')).toBe('~');
    expect(symbolGlyph('MINUS')).toBe('−');
  });
});

describe('symbolName', () => {
  it('names the symbols', () => {
    expect(symbolName('PLUS')).toBe('Plus');
    expect(symbolName('WELLE')).toBe('Welle');
    expect(symbolName('MINUS')).toBe('Minus');
  });
});

describe('valueText', () => {
  it('names the symbols', () => {
    expect(valueText(aCell({ kind: 'symbol', symbol: 'PLUS' }))).toBe('Plus');
    expect(valueText(aCell({ kind: 'symbol', symbol: 'WELLE' }))).toBe('Welle');
    expect(valueText(aCell({ kind: 'symbol', symbol: 'MINUS' }))).toBe('Minus');
  });

  it('gives points with their maximum', () => {
    expect(valueText(aCell({ kind: 'points', points: 24, maxPoints: 30 }))).toBe('24 von 30 Punkten');
    expect(valueText(aCell({ kind: 'points', points: 0, maxPoints: 30 }))).toBe('0 von 30 Punkten');
  });

  it('gives points without a maximum when it is unknown', () => {
    expect(valueText(aCell({ kind: 'points', points: 5, maxPoints: null }))).toBe('5 Punkte');
  });

  it('says that an empty cell is not graded', () => {
    expect(valueText(aCell())).toBe('nicht bewertet');
  });
});

describe('cellAriaLabel', () => {
  it('combines student, assessment and value', () => {
    expect(cellAriaLabel(aCell({ kind: 'symbol', symbol: 'PLUS' }), 'Muster, Max')).toBe('Muster, Max — Mündlich: Plus');
  });

  it('mentions an impromptu assessment, the note text and absence', () => {
    const label = cellAriaLabel(
      aCell({ kind: 'points', points: 17, maxPoints: 20, isImpromptu: true, hasNote: true, noteText: 'Gut gelöst', locked: true }),
      'Muster, Max',
    );
    expect(label).toBe('Muster, Max — Mündlich: 17 von 20 Punkten, spontane Leistung, Notiz: Gut gelöst, abwesend');
  });

  it('describes an empty cell', () => {
    expect(cellAriaLabel(aCell(), 'Muster, Max')).toBe('Muster, Max — Mündlich: nicht bewertet');
  });
});

describe('columnAriaLabel', () => {
  const column = (o: Partial<GridColumn> = {}): GridColumn => ({
    assessmentId: 'a-1',
    title: 'Schularbeit 1',
    categoryTitle: 'Schularbeit',
    gradingType: 'NUMERIC',
    maxPoints: 30,
    ...o,
  });

  it('names title, category and maximum points of a numeric column', () => {
    expect(columnAriaLabel(column())).toBe('Schularbeit 1, Schularbeit, max. 30 Punkte');
  });

  it('names title and category of a tertiary column', () => {
    expect(columnAriaLabel(column({ title: 'Mündlich', categoryTitle: 'Mitarbeit', gradingType: 'TERTIARY', maxPoints: null }))).toBe(
      'Mündlich, Mitarbeit',
    );
  });
});
