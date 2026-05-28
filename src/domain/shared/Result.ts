import { DomainError } from '../../shared/errors';

export type Result<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Result = {
  ok<T, E = DomainError>(value: T): Result<T, E> {
    return { ok: true, value };
  },

  fail<T, E = DomainError>(error: E): Result<T, E> {
    return { ok: false, error };
  },
} as const;
