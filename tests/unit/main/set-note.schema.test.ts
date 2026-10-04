import { setNoteSchema } from '../../../src/main/ipc/schemas';

describe('setNoteSchema', () => {
  it('accepts a performance id with text', () => {
    expect(setNoteSchema.parse({ performanceId: 'p-1', text: 'Meldet sich oft' })).toEqual({
      performanceId: 'p-1',
      text: 'Meldet sich oft',
    });
  });

  it('accepts empty text, which removes the note', () => {
    expect(setNoteSchema.safeParse({ performanceId: 'p-1', text: '' }).success).toBe(true);
  });

  it('accepts text up to 2000 characters and rejects longer text', () => {
    expect(setNoteSchema.safeParse({ performanceId: 'p-1', text: 'x'.repeat(2000) }).success).toBe(true);
    expect(setNoteSchema.safeParse({ performanceId: 'p-1', text: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('rejects a missing or empty performance id', () => {
    expect(setNoteSchema.safeParse({ text: 'x' }).success).toBe(false);
    expect(setNoteSchema.safeParse({ performanceId: '', text: 'x' }).success).toBe(false);
  });

  it('rejects missing or non-string text', () => {
    expect(setNoteSchema.safeParse({ performanceId: 'p-1' }).success).toBe(false);
    expect(setNoteSchema.safeParse({ performanceId: 'p-1', text: 5 }).success).toBe(false);
    expect(setNoteSchema.safeParse({ performanceId: 'p-1', text: null }).success).toBe(false);
  });
});
