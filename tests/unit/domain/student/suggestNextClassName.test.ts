import { suggestNextClassName } from '../../../../src/domain/student/suggestNextClassName';

describe('suggestNextClassName', () => {
  it('increments the leading grade digit', () => {
    expect(suggestNextClassName('4EHIF')).toBe('5EHIF');
  });

  it('keeps the rest of the name untouched', () => {
    expect(suggestNextClassName('1A')).toBe('2A');
    expect(suggestNextClassName('3b Gym')).toBe('4b Gym');
  });

  it('handles multi-digit grades', () => {
    expect(suggestNextClassName('9X')).toBe('10X');
  });

  it('ignores surrounding whitespace', () => {
    expect(suggestNextClassName('  2C ')).toBe('3C');
  });

  it('returns null when the name has no leading digit', () => {
    expect(suggestNextClassName('Wahlfach')).toBeNull();
    expect(suggestNextClassName('A4')).toBeNull();
  });

  it('returns null for an empty name', () => {
    expect(suggestNextClassName('   ')).toBeNull();
  });
});
