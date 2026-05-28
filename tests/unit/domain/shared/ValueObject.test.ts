import { ValueObject } from '../../../../src/domain/shared/ValueObject';

interface TestProps {
  firstName: string;
  lastName: string;
}

class TestValueObject extends ValueObject<TestProps> {
  constructor(props: TestProps) {
    super(props);
  }
}

describe('ValueObject', () => {
  describe('constructor', () => {
    it('stores props', () => {
      const vo = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      expect(vo.props.firstName).toBe('Max');
      expect(vo.props.lastName).toBe('Mustermann');
    });
  });

  describe('equals', () => {
    it('returns true for structurally equal value objects', () => {
      const a = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      const b = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for structurally different value objects', () => {
      const a = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      const b = new TestValueObject({ firstName: 'Anna', lastName: 'Mustermann' });
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when comparing to null', () => {
      const a = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      expect(a.equals(null as unknown as TestValueObject)).toBe(false);
    });

    it('returns false when comparing to undefined', () => {
      const a = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      expect(a.equals(undefined as unknown as TestValueObject)).toBe(false);
    });

    it('returns true for the same reference', () => {
      const a = new TestValueObject({ firstName: 'Max', lastName: 'Mustermann' });
      expect(a.equals(a)).toBe(true);
    });
  });
});
