import { Finding } from '../../../../src/domain/grade/Finding';

class TestFinding extends Finding {
  constructor(id: string) {
    super(id);
  }
}

describe('Finding', () => {
  describe('create', () => {
    it('creates with an id', () => {
      const finding = new TestFinding('f-001');
      expect(finding.id).toBe('f-001');
    });
  });

  describe('equals', () => {
    it('returns true for findings with same id', () => {
      const a = new TestFinding('f-001');
      const b = new TestFinding('f-001');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for findings with different ids', () => {
      const a = new TestFinding('f-001');
      const b = new TestFinding('f-002');
      expect(a.equals(b)).toBe(false);
    });
  });
});
