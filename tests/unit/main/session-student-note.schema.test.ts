import { setSessionStudentNoteSchema } from '../../../src/main/ipc/schemas';

describe('setSessionStudentNoteSchema', () => {
  it('accepts a student id with a text, also an empty one', () => {
    expect(setSessionStudentNoteSchema.parse({ studentId: 's-1', text: 'ruhig' })).toEqual({ studentId: 's-1', text: 'ruhig' });
    expect(setSessionStudentNoteSchema.parse({ studentId: 's-1', text: '' })).toEqual({ studentId: 's-1', text: '' });
  });

  it('rejects a missing or empty student id', () => {
    expect(setSessionStudentNoteSchema.safeParse({ text: 'x' }).success).toBe(false);
    expect(setSessionStudentNoteSchema.safeParse({ studentId: '', text: 'x' }).success).toBe(false);
  });

  it('rejects a missing, non-string or oversized text', () => {
    expect(setSessionStudentNoteSchema.safeParse({ studentId: 's-1' }).success).toBe(false);
    expect(setSessionStudentNoteSchema.safeParse({ studentId: 's-1', text: 1 }).success).toBe(false);
    expect(setSessionStudentNoteSchema.safeParse({ studentId: 's-1', text: 'x'.repeat(2001) }).success).toBe(false);
  });
});
