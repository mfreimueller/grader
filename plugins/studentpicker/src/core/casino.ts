import type { Outcome } from './blackjack';
import type { Student } from './types';

export type PushRule = 'deal-again' | 'pass' | 'answer';
export const PUSH_RULES: readonly PushRule[] = ['deal-again', 'pass', 'answer'];

/** What the hand means for the student. */
export type Consequence = 'answer' | 'pass' | 'deal-again';

/** Kept per course. */
export interface CasinoSettings {
  dealerName: string;
  /** Shown when the student wins. */
  winText: string;
  /** Shown when the bank wins. */
  loseText: string;
  pushRule: PushRule;
}

/** Bank against the class, for this session only. */
export interface Score {
  class: number;
  bank: number;
}

export const MAX_TEXT_LENGTH = 120;

export const DEFAULT_CASINO_SETTINGS: CasinoSettings = {
  dealerName: 'Die Bank',
  winText: 'Du darfst die Frage weitergeben.',
  loseText: 'Du beantwortest die Frage.',
  pushRule: 'deal-again',
};

export const EMPTY_SCORE: Score = { class: 0, bank: 0 };

/** Reads the stored settings defensively: every field that is not valid falls back to its default. */
export function parseCasinoSettings(stored: unknown): CasinoSettings {
  const raw = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const text = (key: 'dealerName' | 'winText' | 'loseText'): string => {
    const value = raw[key];
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return validText(trimmed) ? trimmed : DEFAULT_CASINO_SETTINGS[key];
  };
  const pushRule = PUSH_RULES.find((rule) => rule === raw['pushRule']) ?? DEFAULT_CASINO_SETTINGS.pushRule;
  return { dealerName: text('dealerName'), winText: text('winText'), loseText: text('loseText'), pushRule };
}

/** Whether the editor may save the settings: every text has 1 to MAX_TEXT_LENGTH characters once trimmed. */
export function casinoSettingsValid(settings: CasinoSettings): boolean {
  return [settings.dealerName, settings.winText, settings.loseText].every((text) => validText(text.trim()));
}

function validText(trimmed: string): boolean {
  return trimmed !== '' && trimmed.length <= MAX_TEXT_LENGTH;
}

export function consequence(outcome: Outcome, settings: CasinoSettings): Consequence {
  if (outcome.winner === 'player') return 'pass';
  if (outcome.winner === 'bank') return 'answer';
  return settings.pushRule;
}

export function addToScore(score: Score, outcome: Outcome): Score {
  if (outcome.winner === 'player') return { ...score, class: score.class + 1 };
  if (outcome.winner === 'bank') return { ...score, bank: score.bank + 1 };
  return score;
}

/** Who passed in this session is not drawn again until the plugin is started anew. */
export function withoutPassed(students: readonly Student[], passed: ReadonlySet<string>): Student[] {
  return students.filter((s) => !passed.has(s.id));
}
