import { Note } from '../../../../src/domain/grade/Note';
import { Finding } from '../../../../src/domain/grade/Finding';

describe('Note', () => {
  describe('create', () => {
    it('creates with text content', () => {
      const note = new Note('n-001', 'Gut gemacht');
      expect(note.id).toBe('n-001');
      expect(note.text).toBe('Gut gemacht');
    });

    it('creates with empty text', () => {
      const note = new Note('n-002', '');
      expect(note.text).toBe('');
    });
  });

  describe('inherits Finding', () => {
    it('is an instance of Finding', () => {
      const note = new Note('n-001', 'Gut gemacht');
      expect(note).toBeInstanceOf(Finding);
    });
  });

  describe('equals', () => {
    it('returns true for notes with same id', () => {
      const a = new Note('n-001', 'Text A');
      const b = new Note('n-001', 'Text B');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for notes with different ids', () => {
      const a = new Note('n-001', 'Text');
      const b = new Note('n-002', 'Text');
      expect(a.equals(b)).toBe(false);
    });
  });
});
