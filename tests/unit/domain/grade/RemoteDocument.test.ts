import { RemoteDocument } from '../../../../src/domain/grade/RemoteDocument';
import { Finding } from '../../../../src/domain/grade/Finding';

describe('RemoteDocument', () => {
  describe('create', () => {
    it('creates with a valid URL', () => {
      const doc = new RemoteDocument('r-001', 'https://example.com/doc.pdf');
      expect(doc.id).toBe('r-001');
      expect(doc.url).toBe('https://example.com/doc.pdf');
    });
  });

  describe('inherits Finding', () => {
    it('is an instance of Finding', () => {
      const doc = new RemoteDocument('r-001', 'https://example.com/doc.pdf');
      expect(doc).toBeInstanceOf(Finding);
    });
  });

  describe('equals', () => {
    it('returns true for remote documents with same id', () => {
      const a = new RemoteDocument('r-001', 'https://example.com/a.pdf');
      const b = new RemoteDocument('r-001', 'https://example.com/b.pdf');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for remote documents with different ids', () => {
      const a = new RemoteDocument('r-001', 'https://example.com/a.pdf');
      const b = new RemoteDocument('r-002', 'https://example.com/a.pdf');
      expect(a.equals(b)).toBe(false);
    });
  });
});
