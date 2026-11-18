import {
  emptyProgress,
  progressLabel,
  reduceProgress,
} from '../../../src/renderer/utils/gradeflowProgress';

describe('reduceProgress', () => {
  it('records the model on start and resets everything else', () => {
    const state = reduceProgress({ ...emptyProgress(), turns: 4 }, { kind: 'started', model: 'opus' });

    expect(state).toEqual({ model: 'opus', turns: 0, readIds: [], finished: false });
  });

  it('counts every hand-in once, however often the agent opens it', () => {
    let state = emptyProgress();
    for (const studentId of ['a', 'b', 'a']) state = reduceProgress(state, { kind: 'reading', studentId });

    expect(state.readIds).toEqual(['a', 'b']);
  });

  it('keeps the highest number of turns and marks the end', () => {
    let state = reduceProgress(emptyProgress(), { kind: 'working', turns: 5 });
    state = reduceProgress(state, { kind: 'working', turns: 3 });
    state = reduceProgress(state, { kind: 'reading', studentId: 'x' });
    state = reduceProgress(state, { kind: 'working', turns: 6 });
    state = reduceProgress(state, { kind: 'finished' });

    expect(state).toMatchObject({ turns: 6, readIds: ['x'], finished: true });
  });

  it('does not change the state it was given', () => {
    const before = emptyProgress();

    reduceProgress(before, { kind: 'reading', studentId: 'a' });

    expect(before).toEqual(emptyProgress());
  });
});

describe('progressLabel', () => {
  it('says what is known so far without promising a progress per student', () => {
    expect(progressLabel(emptyProgress())).toBe('Der Agent wird gestartet …');
    expect(progressLabel({ model: 'sonnet', turns: 2, readIds: ['a', 'b', 'c'], finished: false })).toBe(
      'Modell Sonnet · 2 Schritte · bisher 3 Abgaben gelesen',
    );
    expect(progressLabel({ model: 'opus', turns: 1, readIds: ['a'], finished: false })).toBe(
      'Modell Opus · 1 Schritt · bisher 1 Abgabe gelesen',
    );
  });

  it('announces that the result is being checked at the end', () => {
    expect(progressLabel({ model: 'sonnet', turns: 9, readIds: ['a', 'b', 'c', 'd'], finished: true })).toContain('Ergebnis wird geprüft');
  });
});
