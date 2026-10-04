import { setSessionAbsenceSchema } from '../../../src/main/ipc/schemas';

describe('setSessionAbsenceSchema', () => {
  it('accepts a student id with an absent flag', () => {
    expect(setSessionAbsenceSchema.parse({ studentId: 's-1', absent: true })).toEqual({ studentId: 's-1', absent: true });
    expect(setSessionAbsenceSchema.parse({ studentId: 's-1', absent: false })).toEqual({ studentId: 's-1', absent: false });
  });

  it('rejects a missing or empty student id', () => {
    expect(setSessionAbsenceSchema.safeParse({ absent: true }).success).toBe(false);
    expect(setSessionAbsenceSchema.safeParse({ studentId: '', absent: true }).success).toBe(false);
  });

  it('rejects a missing or non-boolean absent flag', () => {
    expect(setSessionAbsenceSchema.safeParse({ studentId: 's-1' }).success).toBe(false);
    expect(setSessionAbsenceSchema.safeParse({ studentId: 's-1', absent: 'yes' }).success).toBe(false);
    expect(setSessionAbsenceSchema.safeParse({ studentId: 's-1', absent: 1 }).success).toBe(false);
  });

  it('rejects unrelated input', () => {
    expect(setSessionAbsenceSchema.safeParse(null).success).toBe(false);
    expect(setSessionAbsenceSchema.safeParse('s-1').success).toBe(false);
  });
});
