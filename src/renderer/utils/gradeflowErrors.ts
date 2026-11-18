// German texts for what can go wrong in a Gradeflow run. The backend sends English, name-and-code-only errors.

import type { GradeflowErrorDto } from '../../shared/gradeflow-api';

const AGENT_MESSAGES: Readonly<Record<string, string>> = {
  NOT_INSTALLED: 'Claude Code ist nicht installiert oder wurde nicht gefunden.',
  NOT_LOGGED_IN:
    'Sie sind nicht bei Claude angemeldet. Starten Sie in einem Terminal `claude` und führen Sie dort `/login` aus. Danach können Sie es erneut versuchen.',
  CANCELLED: 'Die Bewertung wurde abgebrochen.',
  TIMEOUT:
    'Die Bewertung hat zu lange gedauert und wurde gestoppt. Es wurde nichts vorgeschlagen. Die maximale Dauer können Sie in den Einstellungen erhöhen.',
  BUDGET_EXCEEDED:
    'Das Kostenlimit für diesen Lauf wurde erreicht und die Bewertung gestoppt. Es wurde nichts vorgeschlagen. Das Limit können Sie in den Einstellungen erhöhen.',
  NO_STRUCTURED_OUTPUT: 'Der Agent hat kein verwertbares Ergebnis geliefert. Bitte versuchen Sie es erneut.',
  AGENT_ERROR: 'Die Bewertung durch den Agenten ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
};

const NAME_MESSAGES: Readonly<Record<string, string>> = {
  InternalError: 'Es ist ein interner Fehler aufgetreten.',
  NotFoundError: 'Dieser Lauf existiert nicht mehr. Bitte beginnen Sie von vorn.',
  OpenFolderError: 'Der Ordner konnte nicht geöffnet werden.',
};

export function gradeflowErrorMessage(error: GradeflowErrorDto): string {
  if (error.code !== undefined) return AGENT_MESSAGES[error.code] ?? AGENT_MESSAGES['AGENT_ERROR'] ?? error.message;
  return NAME_MESSAGES[error.name] ?? error.message;
}

/** Saving found results that would be replaced; the teacher has to confirm once. */
export function isOverwriteConfirmation(error: GradeflowErrorDto): boolean {
  return error.name === 'OverwriteNeedsConfirmationError' && error.count !== undefined;
}
