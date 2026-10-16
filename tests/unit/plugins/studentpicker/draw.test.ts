import {
  activeSpecials,
  draw,
  fairPool,
  validateSpecials,
} from '../../../../plugins/studentpicker/src/core/draw';
import type { Special, Student } from '../../../../plugins/studentpicker/src/core/types';

function student(id: string, overrides: Partial<Student> = {}): Student {
  return { id, firstName: id, lastName: 'Test', color: null, pickCount: 0, ...overrides };
}

function special(id: string, overrides: Partial<Special> = {}): Special {
  return { id, label: id, color: '#6d28d9', kind: 'spin-again', probability: 10, showIn: 'always', ...overrides };
}

/** A random() that returns the given values in order. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error('random() called more often than expected');
    i += 1;
    return v;
  };
}

/** Small deterministic PRNG so the simulation never flakes. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('fairPool', () => {
  it('contains only the students with the lowest pick count', () => {
    const students = [student('a', { pickCount: 2 }), student('b', { pickCount: 1 }), student('c', { pickCount: 1 })];

    expect(fairPool(students).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('is everybody again once all have the same count', () => {
    const students = [student('a', { pickCount: 3 }), student('b', { pickCount: 3 })];

    expect(fairPool(students).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('is empty without students', () => {
    expect(fairPool([])).toEqual([]);
  });
});

describe('activeSpecials', () => {
  const always = special('always');
  const freeOnly = special('free', { showIn: 'free-only' });

  it('shows every special in free mode', () => {
    expect(activeSpecials([always, freeOnly], false).map((s) => s.id)).toEqual(['always', 'free']);
  });

  it('hides free-only specials in fair mode', () => {
    expect(activeSpecials([always, freeOnly], true).map((s) => s.id)).toEqual(['always']);
  });
});

describe('validateSpecials', () => {
  it('accepts probabilities that sum to less than 100', () => {
    expect(validateSpecials([special('a', { probability: 40 }), special('b', { probability: 59 })])).toEqual({ ok: true });
  });

  it('accepts no specials', () => {
    expect(validateSpecials([])).toEqual({ ok: true });
  });

  it('rejects a sum of 100 or more, even for specials hidden in fair mode', () => {
    const result = validateSpecials([special('a', { probability: 60 }), special('b', { probability: 40, showIn: 'free-only' })]);

    expect(result).toEqual({ ok: false, error: 'sum-too-high' });
  });

  it.each([-1, Number.NaN, 101, Number.POSITIVE_INFINITY])('rejects the single probability %s', (probability) => {
    expect(validateSpecials([special('a', { probability })])).toEqual({ ok: false, error: 'invalid-probability' });
  });
});

describe('draw', () => {
  it('fails when nobody can be picked', () => {
    const result = draw({ students: [], specials: [], fair: true, random: sequence() });

    expect(result).toEqual({ ok: false, error: 'no-students' });
  });

  it('picks the student whose share of the roll contains it, every student equally likely', () => {
    const students = [student('a'), student('b')];
    const pick = (roll: number) => draw({ students, specials: [], fair: false, random: sequence(roll) });

    expect(pick(0.0)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
    expect(pick(0.49)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
    expect(pick(0.5)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
    expect(pick(0.999)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
  });

  it('still picks the last student when random() returns exactly 1, which it should not', () => {
    const result = draw({ students: [student('a'), student('b')], specials: [], fair: false, random: sequence(1) });

    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
  });

  it('picks everybody about equally often over many draws', () => {
    const students = [student('a'), student('b'), student('c'), student('d')];
    const random = mulberry32(42);
    const tally: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };

    for (let i = 0; i < 4000; i++) {
      const result = draw({ students, specials: [], fair: false, random });
      const spin = result.ok ? result.spins[0] : undefined;
      if (spin?.kind === 'student') tally[spin.studentId] = (tally[spin.studentId] ?? 0) + 1;
    }

    for (const count of Object.values(tally)) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('only draws from the fair pool in fair mode', () => {
    const students = [student('a', { pickCount: 1 }), student('b', { pickCount: 0 })];

    const result = draw({ students, specials: [], fair: true, random: sequence(0) });

    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
  });

  it('draws from everybody in free mode, whatever their counts', () => {
    const students = [student('a', { pickCount: 5 }), student('b', { pickCount: 0 })];

    const result = draw({ students, specials: [], fair: false, random: sequence(0) });

    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
  });

  it('draws a message special when the roll falls into its percentage', () => {
    const message = special('msg', { kind: 'message', message: 'Blatt raus', probability: 5 });

    const result = draw({ students: [student('a')], specials: [message], fair: false, random: sequence(0.04) });

    expect(result).toEqual({ ok: true, spins: [{ kind: 'special', special: message }] });
  });

  it('draws a student when the roll is above all special percentages', () => {
    const message = special('msg', { kind: 'message', probability: 5 });

    const result = draw({ students: [student('a')], specials: [message], fair: false, random: sequence(0.05, 0.5) });

    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
  });

  it('checks the specials in order, each one adding to the range of the roll', () => {
    const first = special('first', { kind: 'message', probability: 10 });
    const second = special('second', { kind: 'message', probability: 20 });
    const draws = (roll: number) => draw({ students: [student('a')], specials: [first, second], fair: false, random: sequence(roll, 0) });

    expect(draws(0.09)).toEqual({ ok: true, spins: [{ kind: 'special', special: first }] });
    expect(draws(0.1)).toEqual({ ok: true, spins: [{ kind: 'special', special: second }] });
    expect(draws(0.29)).toEqual({ ok: true, spins: [{ kind: 'special', special: second }] });
    expect(draws(0.3)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
  });

  it('does not draw free-only specials in fair mode', () => {
    const freeOnly = special('free', { kind: 'message', probability: 90, showIn: 'free-only' });

    const result = draw({ students: [student('a')], specials: [freeOnly], fair: true, random: sequence(0.5) });

    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
  });

  it('chains spins after spin-again and ends with the final result', () => {
    const again = special('again', { probability: 10 });

    const result = draw({
      students: [student('a')],
      specials: [again],
      fair: false,
      random: sequence(0.05, 0.02, 0.5, 0.5), // again, again, then no special (50 > 10) and the pick
    });

    expect(result).toEqual({
      ok: true,
      spins: [
        { kind: 'special', special: again },
        { kind: 'special', special: again },
        { kind: 'student', studentId: 'a' },
      ],
    });
  });

  it('ends a chain on a message special', () => {
    const again = special('again', { probability: 10 });
    const message = special('msg', { kind: 'message', probability: 10 });

    const result = draw({ students: [student('a')], specials: [again, message], fair: false, random: sequence(0.05, 0.15) });

    expect(result).toEqual({
      ok: true,
      spins: [
        { kind: 'special', special: again },
        { kind: 'special', special: message },
      ],
    });
  });

  it('stops chaining spin-again after 10 repeats and then ignores specials', () => {
    const again = special('again', { probability: 99 });
    const rolls = [...Array<number>(10).fill(0), 0]; // 10 x spin-again, then the forced pick

    const result = draw({ students: [student('a')], specials: [again], fair: false, random: sequence(...rolls) });

    expect(result.ok && result.spins).toHaveLength(11);
    expect(result.ok && result.spins.at(-1)).toEqual({ kind: 'student', studentId: 'a' });
  });
});
