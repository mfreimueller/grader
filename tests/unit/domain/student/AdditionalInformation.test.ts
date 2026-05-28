import { AdditionalInformation } from '../../../../src/domain/student/AdditionalInformation';

describe('AdditionalInformation', () => {
  describe('create', () => {
    it('creates with key and value', () => {
      const info = new AdditionalInformation('email', 'max@example.com');
      expect(info.key).toBe('email');
      expect(info.value).toBe('max@example.com');
    });
  });

  describe('equals', () => {
    it('returns true for same key (same value)', () => {
      const a = new AdditionalInformation('email', 'max@example.com');
      const b = new AdditionalInformation('email', 'max@example.com');
      expect(a.equals(b)).toBe(true);
    });

    it('returns true for same key (different value) — equality by key', () => {
      const a = new AdditionalInformation('email', 'max@example.com');
      const b = new AdditionalInformation('email', 'other@example.com');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different keys', () => {
      const a = new AdditionalInformation('email', 'max@example.com');
      const b = new AdditionalInformation('phone', '+43123456789');
      expect(a.equals(b)).toBe(false);
    });

    it('returns true for the same reference', () => {
      const a = new AdditionalInformation('email', 'max@example.com');
      expect(a.equals(a)).toBe(true);
    });

    it('returns false when comparing to null', () => {
      const a = new AdditionalInformation('email', 'max@example.com');
      expect(a.equals(null as unknown as AdditionalInformation)).toBe(false);
    });
  });
});
