import { SchoolYear } from '../../../../src/domain/student/SchoolYear';

describe('SchoolYear', () => {
  describe('create', () => {
    it('creates from valid YYYY/YY format', () => {
      const result = SchoolYear.create('2025/26');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.startYear).toBe(2025);
        expect(result.value.endYear).toBe(2026);
      }
    });

    it('creates from valid format with single-digit end year', () => {
      const result = SchoolYear.create('2020/21');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.startYear).toBe(2020);
        expect(result.value.endYear).toBe(2021);
      }
    });

    it('returns DomainError for format without slash', () => {
      const result = SchoolYear.create('2025');
      expect(result.ok).toBe(false);
    });

    it('returns DomainError for format with wrong separator', () => {
      const result = SchoolYear.create('2025-26');
      expect(result.ok).toBe(false);
    });

    it('returns DomainError for non-consecutive years', () => {
      const result = SchoolYear.create('2025/27');
      expect(result.ok).toBe(false);
    });

    it('returns DomainError for start year before 2000', () => {
      const result = SchoolYear.create('1999/00');
      expect(result.ok).toBe(false);
    });

    it('returns DomainError for empty string', () => {
      const result = SchoolYear.create('');
      expect(result.ok).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the original YYYY/YY format', () => {
      const result = SchoolYear.create('2025/26');
      expect(result.ok && result.value.toString()).toBe('2025/26');
    });
  });

  describe('startDate', () => {
    it('returns September 1st of the start year', () => {
      const result = SchoolYear.create('2025/26');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const date = result.value.startDate;
        expect(date.getFullYear()).toBe(2025);
        expect(date.getMonth()).toBe(8); // September = 8 (0-indexed)
        expect(date.getDate()).toBe(1);
      }
    });
  });

  describe('equals', () => {
    it('returns true for SchoolYears with same start and end year', () => {
      const a = SchoolYear.create('2025/26');
      const b = SchoolYear.create('2025/26');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different SchoolYears', () => {
      const a = SchoolYear.create('2024/25');
      const b = SchoolYear.create('2025/26');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });

  describe('compareTo', () => {
    it('returns negative when this school year is earlier', () => {
      const a = SchoolYear.create('2024/25');
      const b = SchoolYear.create('2025/26');
      expect(a.ok && b.ok && a.value.compareTo(b.value)).toBeLessThan(0);
    });

    it('returns positive when this school year is later', () => {
      const a = SchoolYear.create('2025/26');
      const b = SchoolYear.create('2024/25');
      expect(a.ok && b.ok && a.value.compareTo(b.value)).toBeGreaterThan(0);
    });

    it('returns 0 for the same school year', () => {
      const a = SchoolYear.create('2025/26');
      const b = SchoolYear.create('2025/26');
      expect(a.ok && b.ok && a.value.compareTo(b.value)).toBe(0);
    });
  });

  describe('next', () => {
    it('returns the following school year', () => {
      const year = SchoolYear.create('2025/26');
      expect(year.ok && year.value.next().toString()).toBe('2026/27');
    });

    it('rolls over the decade in the short end year', () => {
      const year = SchoolYear.create('2029/30');
      expect(year.ok && year.value.next().toString()).toBe('2030/31');
    });
  });
});
