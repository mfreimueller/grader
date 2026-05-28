import { Result } from '../../../../src/domain/shared/Result';

describe('Result', () => {
  describe('ok', () => {
    it('creates a success result with a value', () => {
      const result = Result.ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('fail', () => {
    it('creates a failure result with an error', () => {
      const error = new Error('something went wrong');
      const result = Result.fail(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('type narrowing', () => {
    it('allows access to value after checking ok is true', () => {
      const result: Result<number, Error> = Result.ok(42);
      if (result.ok) {
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });

    it('allows access to error after checking ok is false', () => {
      const result: Result<number, Error> = Result.fail(new Error('fail'));
      if (!result.ok) {
        const error: Error = result.error;
        expect(error.message).toBe('fail');
      }
    });
  });
});
