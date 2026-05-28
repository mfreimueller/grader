import { generateId } from '../../../../src/domain/shared/IdGenerator';

describe('IdGenerator', () => {
  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('returns unique IDs on successive calls', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });

    it('contains a dash separator', () => {
      const id = generateId();
      expect(id).toContain('-');
    });
  });
});
