import { BridgeFailure, errorText, toPlain, unwrap } from '../../../../plugins/studentpicker/src/core/bridgeError';

describe('unwrap', () => {
  it('returns the value of a successful answer', () => {
    expect(unwrap({ ok: true, value: { a: 1 } })).toEqual({ a: 1 });
  });

  it('returns nothing for a successful command', () => {
    expect(unwrap({ ok: true, value: undefined })).toBeUndefined();
  });

  it('throws a BridgeFailure carrying the code of a refused call', () => {
    const answer = { ok: false, error: { code: 'NOT_IN_COURSE', message: 'Student s-1 does not belong to this course' } } as const;

    expect(() => unwrap(answer)).toThrow(BridgeFailure);
    try {
      unwrap(answer);
    } catch (error) {
      expect((error as BridgeFailure).code).toBe('NOT_IN_COURSE');
      expect((error as BridgeFailure).message).toBe('Student s-1 does not belong to this course');
    }
  });
});

describe('errorText', () => {
  it('explains a refused call in German', () => {
    expect(errorText(new BridgeFailure('NOT_IN_COURSE', 'x'))).toBe('Diese Person gehört nicht (mehr) zum Kurs.');
  });

  it('does not show the details of anything else', () => {
    expect(errorText(new Error('TypeError: cannot read properties of undefined'))).toBe('In Grader ist ein Fehler aufgetreten.');
    expect(errorText('boom')).toBe('In Grader ist ein Fehler aufgetreten.');
  });
});

describe('toPlain', () => {
  it('copies data into plain objects, which is what crosses the bridge', () => {
    const original = { counts: { a: 1 }, list: [{ id: 'x' }] };

    const copy = toPlain(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.counts).not.toBe(original.counts);
  });

  it('turns a Proxy, such as a Vue reactive object, into a plain object', () => {
    const proxied = new Proxy({ a: 1 }, {});

    expect(structuredClone(toPlain(proxied))).toEqual({ a: 1 });
  });
});
