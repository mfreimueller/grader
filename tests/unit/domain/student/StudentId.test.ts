import { StudentId } from '../../../../src/domain/student/StudentId';

describe('StudentId', () => {
  describe('create', () => {
    it('creates a valid StudentId from a non-empty string', () => {
      const result = StudentId.create('s-001');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('s-001');
      }
    });

    it('creates a valid StudentId from a UUID string', () => {
      const result = StudentId.create('550e8400-e29b-41d4-a716-446655440000');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.value).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('returns a DomainError for an empty string', () => {
      const result = StudentId.create('');
      expect(result.ok).toBe(false);
    });

    it('returns a DomainError for a whitespace-only string', () => {
      const result = StudentId.create('   ');
      expect(result.ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for StudentIds with the same value', () => {
      const a = StudentId.create('s-001');
      const b = StudentId.create('s-001');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('returns false for StudentIds with different values', () => {
      const a = StudentId.create('s-001');
      const b = StudentId.create('s-002');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
