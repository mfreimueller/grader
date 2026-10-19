import { ParticipationSymbol } from '../../../../src/domain/grade/ParticipationSymbol';

describe('ParticipationSymbol', () => {
  describe('create', () => {
    it('creates PLUS', () => {
      const result = ParticipationSymbol.create('PLUS');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('PLUS');
      }
    });

    it('creates MINUS', () => {
      const result = ParticipationSymbol.create('MINUS');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('MINUS');
      }
    });

    it('creates WELLE', () => {
      const result = ParticipationSymbol.create('WELLE');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('WELLE');
      }
    });

    it.each(['PLUS_WELLE', 'MINUS_WELLE'])('creates %s', (raw) => {
      const result = ParticipationSymbol.create(raw);
      expect(result.ok && result.value.value).toBe(raw);
    });

    it('returns DomainError for invalid symbol', () => {
      const result = ParticipationSymbol.create('INVALID');
      expect(result.ok).toBe(false);
    });

    it('returns DomainError for empty string', () => {
      const result = ParticipationSymbol.create('');
      expect(result.ok).toBe(false);
    });
  });

  describe('toScore', () => {
    it('returns 1.0 for PLUS', () => {
      const result = ParticipationSymbol.create('PLUS');
      expect(result.ok && result.value.toScore()).toBe(1.0);
    });

    it('returns 0.5 for WELLE', () => {
      const result = ParticipationSymbol.create('WELLE');
      expect(result.ok && result.value.toScore()).toBe(0.5);
    });

    it('returns 0.75 for PLUS_WELLE', () => {
      const result = ParticipationSymbol.create('PLUS_WELLE');
      expect(result.ok && result.value.toScore()).toBe(0.75);
    });

    it('returns 0.25 for MINUS_WELLE', () => {
      const result = ParticipationSymbol.create('MINUS_WELLE');
      expect(result.ok && result.value.toScore()).toBe(0.25);
    });

    it('returns 0.0 for MINUS', () => {
      const result = ParticipationSymbol.create('MINUS');
      expect(result.ok && result.value.toScore()).toBe(0.0);
    });
  });

  describe('equals', () => {
    it('returns true for same symbol', () => {
      const a = ParticipationSymbol.create('PLUS');
      const b = ParticipationSymbol.create('PLUS');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different symbols', () => {
      const a = ParticipationSymbol.create('PLUS');
      const b = ParticipationSymbol.create('MINUS');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
