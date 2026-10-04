import { parsePoints, resolveSymbolPick, symbolForKey } from '../../../src/renderer/utils/sessionGridInput';

describe('parsePoints', () => {
  it('treats empty input as clearing the result', () => {
    expect(parsePoints('', 30)).toEqual({ kind: 'clear' });
    expect(parsePoints('   ', 30)).toEqual({ kind: 'clear' });
  });

  it('accepts whole numbers from 0 up to the maximum', () => {
    expect(parsePoints('24', 30)).toEqual({ kind: 'value', points: 24 });
    expect(parsePoints('0', 30)).toEqual({ kind: 'value', points: 0 });
    expect(parsePoints('30', 30)).toEqual({ kind: 'value', points: 30 });
  });

  it('trims surrounding whitespace and ignores leading zeros', () => {
    expect(parsePoints(' 24 ', 30)).toEqual({ kind: 'value', points: 24 });
    expect(parsePoints('007', 30)).toEqual({ kind: 'value', points: 7 });
  });

  it('rejects more than the maximum and names the maximum', () => {
    expect(parsePoints('31', 30)).toEqual({ kind: 'invalid', message: 'Max. 30 Punkte' });
    expect(parsePoints('99999999999999999999', 30)).toEqual({ kind: 'invalid', message: 'Max. 30 Punkte' });
  });

  it('rejects negative numbers', () => {
    expect(parsePoints('-1', 30)).toEqual({ kind: 'invalid', message: 'Punkte können nicht negativ sein.' });
  });

  it('rejects anything that is not a whole number', () => {
    for (const raw of ['12.5', '12,5', 'abc', '1e2', '1 2', '+5', '٣', '5%']) {
      expect(parsePoints(raw, 30)).toEqual({ kind: 'invalid', message: 'Bitte eine ganze Zahl eingeben.' });
    }
  });
});

describe('symbolForKey', () => {
  it('maps the typed keys to symbols', () => {
    expect(symbolForKey('+')).toBe('PLUS');
    expect(symbolForKey('~')).toBe('WELLE');
    expect(symbolForKey('-')).toBe('MINUS');
  });

  it('also accepts the typographic minus signs', () => {
    expect(symbolForKey('−')).toBe('MINUS');
    expect(symbolForKey('–')).toBe('MINUS');
  });

  it('returns null for every other key', () => {
    for (const key of ['a', '', 'Enter', 'Plus', '++', '1', ' ']) {
      expect(symbolForKey(key)).toBeNull();
    }
  });
});

describe('resolveSymbolPick', () => {
  it('sets the picked symbol when the cell has another one or none', () => {
    expect(resolveSymbolPick(null, 'PLUS')).toBe('PLUS');
    expect(resolveSymbolPick('MINUS', 'PLUS')).toBe('PLUS');
  });

  it('clears the cell when the active symbol is picked again', () => {
    expect(resolveSymbolPick('PLUS', 'PLUS')).toBeNull();
    expect(resolveSymbolPick('WELLE', 'WELLE')).toBeNull();
  });
});
