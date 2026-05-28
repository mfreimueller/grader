import { Name } from '../../../../src/domain/student/Name';

describe('Name', () => {
  describe('create', () => {
    it('creates a valid Name with non-empty first and last name', () => {
      const result = Name.create('Max', 'Mustermann');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.firstName).toBe('Max');
        expect(result.value.lastName).toBe('Mustermann');
      }
    });

    it('trims whitespace from first and last name', () => {
      const result = Name.create('  Max  ', '  Mustermann  ');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.firstName).toBe('Max');
        expect(result.value.lastName).toBe('Mustermann');
      }
    });

    it('returns a DomainError when firstName is empty', () => {
      const result = Name.create('', 'Mustermann');
      expect(result.ok).toBe(false);
    });

    it('returns a DomainError when lastName is empty', () => {
      const result = Name.create('Max', '');
      expect(result.ok).toBe(false);
    });

    it('returns a DomainError when both names are empty', () => {
      const result = Name.create('', '');
      expect(result.ok).toBe(false);
    });

    it('returns a DomainError when firstName is only whitespace', () => {
      const result = Name.create('   ', 'Mustermann');
      expect(result.ok).toBe(false);
    });

    it('returns a DomainError when lastName is only whitespace', () => {
      const result = Name.create('Max', '   ');
      expect(result.ok).toBe(false);
    });
  });

  describe('fullName', () => {
    it('returns "firstName lastName"', () => {
      const result = Name.create('Max', 'Mustermann');
      expect(result.ok && result.value.fullName).toBe('Max Mustermann');
    });
  });

  describe('equals', () => {
    it('returns true for Names with same first and last name', () => {
      const a = Name.create('Max', 'Mustermann');
      const b = Name.create('Max', 'Mustermann');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('returns false for Names with different first names', () => {
      const a = Name.create('Max', 'Mustermann');
      const b = Name.create('Anna', 'Mustermann');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });

    it('returns false for Names with different last names', () => {
      const a = Name.create('Max', 'Mustermann');
      const b = Name.create('Max', 'Musterfrau');
      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(false);
    });
  });
});
