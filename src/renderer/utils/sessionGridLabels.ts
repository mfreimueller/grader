// Texts of the session grid that are derived from a cell or column: screen-reader labels and symbol glyphs.

import type { GridCell, GridColumn, GridSymbol } from './sessionGridModel';

const GLYPHS: Readonly<Record<GridSymbol, string>> = { PLUS: '+', WELLE: '~', MINUS: '−' };
const NAMES: Readonly<Record<GridSymbol, string>> = { PLUS: 'Plus', WELLE: 'Welle', MINUS: 'Minus' };

export function symbolGlyph(symbol: GridSymbol): string {
  return GLYPHS[symbol];
}

export function symbolName(symbol: GridSymbol): string {
  return NAMES[symbol];
}

export function valueText(cell: GridCell): string {
  if (cell.kind === 'symbol' && cell.symbol !== null) return symbolName(cell.symbol);
  if (cell.kind === 'points' && cell.points !== null) {
    return cell.maxPoints !== null ? `${cell.points} von ${cell.maxPoints} Punkten` : `${cell.points} Punkte`;
  }
  return 'nicht bewertet';
}

export function cellAriaLabel(cell: GridCell, studentName: string): string {
  const parts = [`${studentName} — ${cell.title}: ${valueText(cell)}`];
  if (cell.isImpromptu) parts.push('spontane Leistung');
  if (cell.hasNote) parts.push(`Notiz: ${cell.noteText ?? ''}`);
  if (cell.locked) parts.push('abwesend');
  return parts.join(', ');
}

export function columnAriaLabel(column: GridColumn): string {
  const base = `${column.title}, ${column.categoryTitle}`;
  return column.gradingType === 'NUMERIC' && column.maxPoints !== null ? `${base}, max. ${column.maxPoints} Punkte` : base;
}
