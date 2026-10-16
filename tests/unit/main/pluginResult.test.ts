import { NotInCourseError, PluginPermissionDeniedError } from '../../../src/application/PluginCaller';
import { Result } from '../../../src/domain/shared/Result';
import { toPluginResult } from '../../../src/main/plugins/pluginResult';
import { ConflictError, DomainError, NotFoundError, ValidationError } from '../../../src/shared/errors';

class UnexpectedDomainError extends DomainError {}

describe('toPluginResult', () => {
  it('passes a value through', () => {
    expect(toPluginResult(Result.ok({ a: 1 }))).toEqual({ ok: true, value: { a: 1 } });
  });

  it('passes undefined through for a command', () => {
    expect(toPluginResult(Result.ok(undefined as void))).toEqual({ ok: true, value: undefined });
  });

  it.each([
    ['PERMISSION_DENIED', new PluginPermissionDeniedError('no')],
    ['NOT_IN_COURSE', new NotInCourseError('Student', 's-1')],
    ['NOT_FOUND', new NotFoundError('Course', 'c-1')],
    ['VALIDATION', new ValidationError('bad')],
    ['VALIDATION', new ConflictError('clash')],
  ])('maps to the code %s', (code, error) => {
    const result = toPluginResult(Result.fail(error));

    expect(result).toEqual({ ok: false, error: { code, message: error.message } });
  });

  it('hides the details of an error it does not know', () => {
    const result = toPluginResult(Result.fail(new UnexpectedDomainError('SQLITE_BUSY at /Users/x/grdr.db')));

    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Internal error' } });
  });
});
