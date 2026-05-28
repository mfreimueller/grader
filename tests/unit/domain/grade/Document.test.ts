import { Document } from '../../../../src/domain/grade/Document';
import { Finding } from '../../../../src/domain/grade/Finding';

describe('Document', () => {
  describe('create', () => {
    it('creates with a valid file path', () => {
      const doc = new Document('d-001', '/path/to/file.pdf');
      expect(doc.id).toBe('d-001');
      expect(doc.filePath).toBe('/path/to/file.pdf');
    });

    it('creates with a relative path', () => {
      const doc = new Document('d-002', 'docs/notes.txt');
      expect(doc.filePath).toBe('docs/notes.txt');
    });
  });

  describe('inherits Finding', () => {
    it('is an instance of Finding', () => {
      const doc = new Document('d-001', '/path/to/file.pdf');
      expect(doc).toBeInstanceOf(Finding);
    });
  });

  describe('equals', () => {
    it('returns true for documents with same id', () => {
      const a = new Document('d-001', '/path/a.pdf');
      const b = new Document('d-001', '/path/b.pdf');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for documents with different ids', () => {
      const a = new Document('d-001', '/path/a.pdf');
      const b = new Document('d-002', '/path/a.pdf');
      expect(a.equals(b)).toBe(false);
    });
  });
});
