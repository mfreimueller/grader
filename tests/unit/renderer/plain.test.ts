import { reactive } from 'vue';
import { plain } from '../../../src/renderer/utils/plain';

describe('plain', () => {
  it('turns a Vue proxy into a structured-cloneable copy', () => {
    const state = reactive({ rows: [{ studentId: 's', comment: 'x' }] });

    expect(() => structuredClone(state.rows)).toThrow();
    expect(structuredClone(plain(state.rows))).toEqual([{ studentId: 's', comment: 'x' }]);
  });

  it('drops undefined fields, which suits optional properties', () => {
    expect(plain({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
});
