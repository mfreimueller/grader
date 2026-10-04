// Input rules of the session grid as pure functions: parsing the points typed into a cell and mapping keys
// to Mitarbeit symbols.

import type { GridSymbol } from './sessionGridModel';

/** Where the focus goes after an inline edit was committed. */
export type CommitDirection = 'down' | 'left' | 'right' | 'stay';

export type PointsParse =
  | { kind: 'clear' }
  | { kind: 'value'; points: number }
  | { kind: 'invalid'; message: string };

/** Points are whole numbers (the IPC contract only accepts integers). Empty input clears the result. */
export function parsePoints(raw: string, maxPoints: number): PointsParse {
  const text = raw.trim();
  if (text === '') return { kind: 'clear' };
  if (!/^-?\d+$/.test(text)) return { kind: 'invalid', message: 'Bitte eine ganze Zahl eingeben.' };
  if (text.startsWith('-')) return { kind: 'invalid', message: 'Punkte können nicht negativ sein.' };
  const points = Number(text);
  if (points > maxPoints) return { kind: 'invalid', message: `Max. ${maxPoints} Punkte` };
  return { kind: 'value', points };
}

const KEY_SYMBOLS: ReadonlyMap<string, GridSymbol> = new Map([
  ['+', 'PLUS'],
  ['~', 'WELLE'],
  ['-', 'MINUS'],
  ['−', 'MINUS'],
  ['–', 'MINUS'],
]);

/** The symbol a typed key stands for, or null for any other key. */
export function symbolForKey(key: string): GridSymbol | null {
  return KEY_SYMBOLS.get(key) ?? null;
}

/** Picking the symbol a cell already has clears it; any other pick sets it. Null means "clear". */
export function resolveSymbolPick(current: GridSymbol | null, picked: GridSymbol): GridSymbol | null {
  return current === picked ? null : picked;
}
