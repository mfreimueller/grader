import { GradingType } from '../../../../src/domain/grade/GradingType';

describe('GradingType', () => {
  it('has NUMERIC value', () => {
    expect(GradingType.NUMERIC).toBe('NUMERIC');
  });

  it('has TERTIARY value', () => {
    expect(GradingType.TERTIARY).toBe('TERTIARY');
  });

  it('converts from string "NUMERIC"', () => {
    const result = GradingType.fromString('NUMERIC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(GradingType.NUMERIC);
    }
  });

  it('converts from string "TERTIARY"', () => {
    const result = GradingType.fromString('TERTIARY');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(GradingType.TERTIARY);
    }
  });

  it('returns error for invalid string', () => {
    const result = GradingType.fromString('INVALID');
    expect(result.ok).toBe(false);
  });

  it('returns error for empty string', () => {
    const result = GradingType.fromString('');
    expect(result.ok).toBe(false);
  });

  it('is case-sensitive', () => {
    const result = GradingType.fromString('numeric');
    expect(result.ok).toBe(false);
  });
});
