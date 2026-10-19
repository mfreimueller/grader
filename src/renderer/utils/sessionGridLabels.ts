// Texts of the session grid that are derived from a cell or column: screen-reader labels and symbol glyphs.

import type { GridCell, GridColumn, GridSymbol } from './sessionGridModel';

const GLYPHS: Readonly<Record<GridSymbol, string>> = {
  PLUS: '+',
  PLUS_WELLE: '+~',
  WELLE: '~',
  MINUS_WELLE: '−~',
  MINUS: '−',
};
const NAMES: Readonly<Record<GridSymbol, string>> = {
  PLUS: 'Plus',
  PLUS_WELLE: 'Plus-Welle',
  WELLE: 'Welle',
  MINUS_WELLE: 'Minus-Welle',
  MINUS: 'Minus',
};

export function symbolGlyph(symbol: GridSymbol): string {
  return GLYPHS[symbol];
}

/** The glyph of a symbol as it comes over IPC, or a dash when it is missing or unknown. */
export function participationGlyph(raw: string | null): string {
  return raw !== null && Object.hasOwn(GLYPHS, raw) ? GLYPHS[raw as GridSymbol] : '—';
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
  const parts = [cell.isDraft ? `${studentName} — neue Mitarbeit erfassen` : `${studentName} — ${cell.title}: ${valueText(cell)}`];
  if (cell.isImpromptu && !cell.isMitarbeit) parts.push('spontane Leistung');
  if (cell.hasNote) parts.push(`Notiz: ${cell.noteText ?? ''}`);
  if (cell.locked) parts.push('abwesend');
  return parts.join(', ');
}

export function columnAriaLabel(column: GridColumn): string {
  const base = `${column.title}, ${column.categoryTitle}`;
  return column.gradingType === 'NUMERIC' && column.maxPoints !== null ? `${base}, max. ${column.maxPoints} Punkte` : base;
}
