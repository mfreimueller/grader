import { Entity } from '../../../../src/domain/shared/Entity';

class TestEntity extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

class TestNumberEntity extends Entity<number> {
  constructor(id: number) {
    super(id);
  }
}

describe('Entity', () => {
  describe('constructor', () => {
    it('creates an entity with the given id', () => {
      const entity = new TestEntity('abc-123');
      expect(entity.id).toBe('abc-123');
    });

    it('creates an entity with a numeric id', () => {
      const entity = new TestNumberEntity(42);
      expect(entity.id).toBe(42);
    });
  });

  describe('equals', () => {
    it('returns true for entities with the same id', () => {
      const a = new TestEntity('abc-123');
      const b = new TestEntity('abc-123');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for entities with different ids', () => {
      const a = new TestEntity('abc-123');
      const b = new TestEntity('def-456');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when comparing to null', () => {
      const a = new TestEntity('abc-123');
      expect(a.equals(null as unknown as TestEntity)).toBe(false);
    });

    it('returns false when comparing to undefined', () => {
      const a = new TestEntity('abc-123');
      expect(a.equals(undefined as unknown as TestEntity)).toBe(false);
    });

    it('returns true for the same reference', () => {
      const a = new TestEntity('abc-123');
      expect(a.equals(a)).toBe(true);
    });
  });
});
