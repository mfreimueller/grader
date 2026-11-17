import {
  addToScore,
  consequence,
  DEFAULT_CASINO_SETTINGS,
  EMPTY_SCORE,
  MAX_TEXT_LENGTH,
  parseCasinoSettings,
  withoutPassed,
  type CasinoSettings,
} from '../../../../plugins/studentpicker/src/core/casino';
import type { Outcome } from '../../../../plugins/studentpicker/src/core/blackjack';
import type { Student } from '../../../../plugins/studentpicker/src/core/types';

const WIN: Outcome = { result: 'win', winner: 'player', net: 1 };
const BLACKJACK: Outcome = { result: 'blackjack', winner: 'player', net: 1.5 };
const LOSE: Outcome = { result: 'lose', winner: 'bank', net: -1 };
const BUST: Outcome = { result: 'bust', winner: 'bank', net: -2 };
const PUSH: Outcome = { result: 'push', winner: 'push', net: 0 };

const settings = (overrides: Partial<CasinoSettings> = {}): CasinoSettings => ({ ...DEFAULT_CASINO_SETTINGS, ...overrides });

describe('casino', () => {
  describe('parseCasinoSettings', () => {
    it('uses the defaults when nothing usable is stored', () => {
      expect([undefined, null, 'x', 3, []].map(parseCasinoSettings)).toEqual(Array(5).fill(DEFAULT_CASINO_SETTINGS));
      expect(DEFAULT_CASINO_SETTINGS.pushRule).toBe('deal-again');
    });

    it('reads stored values, trimmed', () => {
      expect(
        parseCasinoSettings({ dealerName: ' Frau Huber ', winText: ' Weitergeben ', loseText: 'Antworten', pushRule: 'answer' }),
      ).toEqual({ dealerName: 'Frau Huber', winText: 'Weitergeben', loseText: 'Antworten', pushRule: 'answer' });
    });

    it('falls back per field for blank, too long, wrongly typed or unknown values', () => {
      const parsed = parseCasinoSettings({
        dealerName: '   ',
        winText: 'x'.repeat(MAX_TEXT_LENGTH + 1),
        loseText: 42,
        pushRule: 'replay',
      });
      expect(parsed).toEqual(DEFAULT_CASINO_SETTINGS);
    });

    it('accepts every push rule', () => {
      expect(['deal-again', 'pass', 'answer'].map((pushRule) => parseCasinoSettings({ pushRule }).pushRule)).toEqual([
        'deal-again',
        'pass',
        'answer',
      ]);
    });
  });

  describe('consequence', () => {
    it('lets the student pass when the student wins', () => {
      expect([WIN, BLACKJACK].map((o) => consequence(o, settings()))).toEqual(['pass', 'pass']);
    });

    it('makes the student answer when the bank wins', () => {
      expect([LOSE, BUST].map((o) => consequence(o, settings()))).toEqual(['answer', 'answer']);
    });

    it('follows the push rule on a push', () => {
      expect(
        (['deal-again', 'pass', 'answer'] as const).map((pushRule) => consequence(PUSH, settings({ pushRule }))),
      ).toEqual(['deal-again', 'pass', 'answer']);
    });
  });

  describe('addToScore', () => {
    it('counts the hands won by the class and by the bank; a push counts for nobody', () => {
      const score = [WIN, LOSE, BLACKJACK, PUSH, BUST, LOSE].reduce(addToScore, EMPTY_SCORE);
      expect(score).toEqual({ class: 2, bank: 3 });
      expect(EMPTY_SCORE).toEqual({ class: 0, bank: 0 });
    });
  });

  describe('withoutPassed', () => {
    it('leaves out the students who passed in this session', () => {
      const student = (id: string): Student => ({ id, firstName: id, lastName: 'T', color: null, pickCount: 0 });
      expect(withoutPassed([student('a'), student('b'), student('c')], new Set(['b'])).map((s) => s.id)).toEqual(['a', 'c']);
    });
  });
});
