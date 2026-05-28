import { GradingType, gradingTypeFromString } from '../../../../src/domain/grade/GradingType';

describe('GradingType', () => {
  it('has NUMERIC value', () => {
    expect(GradingType.NUMERIC).toBe('NUMERIC');
  });

  it('has TERTIARY value', () => {
    expect(GradingType.TERTIARY).toBe('TERTIARY');
  });

  it('converts from string "NUMERIC"', () => {
    const result = gradingTypeFromString('NUMERIC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(GradingType.NUMERIC);
    }
  });

  it('converts from string "TERTIARY"', () => {
    const result = gradingTypeFromString('TERTIARY');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(GradingType.TERTIARY);
    }
  });

  it('returns error for invalid string', () => {
    const result = gradingTypeFromString('INVALID');
    expect(result.ok).toBe(false);
  });

  it('returns error for empty string', () => {
    const result = gradingTypeFromString('');
    expect(result.ok).toBe(false);
  });

  it('is case-sensitive', () => {
    const result = gradingTypeFromString('numeric');
    expect(result.ok).toBe(false);
  });
});
