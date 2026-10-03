import { Color } from '../../../../src/domain/student/Color';

describe('Color', () => {
  describe('create', () => {
    it('accepts a six-digit hex color', () => {
      const result = Color.create('#ed1943');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('#ed1943');
    });

    it('normalises upper case to lower case', () => {
      const result = Color.create('#ED1943');

      expect(result.ok && result.value.value).toBe('#ed1943');
    });

    it.each(['ed1943', '#ed194', '#ed19433', '#gggggg', '', 'red'])(
      'rejects %p',
      (raw) => {
        expect(Color.create(raw).ok).toBe(false);
      },
    );
  });

  describe('equals', () => {
    it('is true for the same color regardless of case', () => {
      const a = Color.create('#ED1943');
      const b = Color.create('#ed1943');

      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });
  });
});
