import { gradeflowErrorMessage, isOverwriteConfirmation } from '../../../src/renderer/utils/gradeflowErrors';

describe('gradeflowErrorMessage', () => {
  const agent = (code: string) => gradeflowErrorMessage({ name: 'AgentRunError', message: 'x', code });

  it('explains how to log in again', () => {
    const text = agent('NOT_LOGGED_IN');
    expect(text).toContain('nicht bei Claude angemeldet');
    expect(text).toContain('`claude`');
    expect(text).toContain('`/login`');
  });

  it('points to the settings when a limit was hit', () => {
    expect(agent('BUDGET_EXCEEDED')).toContain('Einstellungen');
    expect(agent('TIMEOUT')).toContain('Einstellungen');
  });

  it.each([
    ['NOT_INSTALLED', 'nicht installiert'],
    ['CANCELLED', 'abgebrochen'],
    ['NO_STRUCTURED_OUTPUT', 'kein verwertbares Ergebnis'],
    ['AGENT_ERROR', 'fehlgeschlagen'],
  ])('describes %s', (code, fragment) => {
    expect(agent(code)).toContain(fragment);
  });

  it('treats an unknown agent code like a generic agent error', () => {
    expect(agent('SOMETHING_NEW')).toBe(agent('AGENT_ERROR'));
  });

  it('translates errors without a code by name', () => {
    expect(gradeflowErrorMessage({ name: 'InternalError', message: 'Internal error' })).toContain('interner Fehler');
    expect(gradeflowErrorMessage({ name: 'NotFoundError', message: 'x' })).toContain('nicht mehr');
    expect(gradeflowErrorMessage({ name: 'OpenFolderError', message: 'x' })).toContain('Ordner');
  });

  it('falls back to the message of the backend', () => {
    expect(gradeflowErrorMessage({ name: 'ValidationError', message: 'Another Gradeflow run is still open' })).toBe(
      'Another Gradeflow run is still open',
    );
  });
});

describe('isOverwriteConfirmation', () => {
  it('is true only for the error that carries a count of results to replace', () => {
    expect(isOverwriteConfirmation({ name: 'OverwriteNeedsConfirmationError', message: 'x', count: 2 })).toBe(true);
    expect(isOverwriteConfirmation({ name: 'ValidationError', message: 'x' })).toBe(false);
    expect(isOverwriteConfirmation({ name: 'OverwriteNeedsConfirmationError', message: 'x' })).toBe(false);
  });
});
