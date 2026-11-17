/*
 * One hand of fair blackjack, student against the bank. Rules adapted from ClassroomCasino
 * (github.com/MiguelHaudek/ClassroomCasino); its outcome steering is deliberately left out.
 * Six decks, dealer stands on soft 17, double on the first two cards, no split, no insurance.
 */

export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

const DECKS = 6;
const CUT_SHARE = 0.25;

export interface Card {
  rank: Rank;
  suit: Suit;
  /** 1 for an ace, 10 for 10/J/Q/K. */
  value: number;
}

export interface Shoe {
  /** The next card is the last one. */
  cards: readonly Card[];
  /** Reshuffle before a round once this many cards or fewer are left. */
  cutAt: number;
}

export interface Round {
  shoe: Shoe;
  player: readonly Card[];
  /** Up card first, then the hole card and the cards the dealer draws. */
  dealer: readonly Card[];
  doubled: boolean;
  phase: 'player' | 'done';
}

export interface HandValue {
  total: number;
  soft: boolean;
}

export interface Actions {
  hit: boolean;
  stand: boolean;
  double: boolean;
}

export type HandResult = 'blackjack' | 'win' | 'lose' | 'bust' | 'push';

export interface Outcome {
  result: HandResult;
  winner: 'player' | 'bank' | 'push';
  /** Stake won (+) or lost (−) by the student; blackjack pays 3:2. */
  net: number;
}

export function newShoe(random: () => number): Shoe {
  const cards: Card[] = [];
  for (let d = 0; d < DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit, value: valueOf(rank) });
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return { cards, cutAt: Math.floor(cards.length * CUT_SHARE) };
}

export function needsShuffle(shoe: Shoe): boolean {
  return shoe.cards.length <= shoe.cutAt;
}

export function handValue(cards: readonly Card[]): HandValue {
  const hard = cards.reduce((sum, c) => sum + c.value, 0);
  const soft = cards.some((c) => c.value === 1) && hard + 10 <= 21;
  return { total: soft ? hard + 10 : hard, soft };
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function deal(shoe: Shoe, random: () => number): Round {
  const draw = drawer(needsShuffle(shoe) ? newShoe(random) : shoe);
  const p1 = draw.next();
  const up = draw.next();
  const p2 = draw.next();
  const hole = draw.next();
  const round: Round = { shoe: draw.shoe(), player: [p1, p2], dealer: [up, hole], doubled: false, phase: 'player' };
  return isBlackjack(round.player) || isBlackjack(round.dealer) ? { ...round, phase: 'done' } : round;
}

export function allowedActions(round: Round): Actions {
  const open = round.phase === 'player';
  return { hit: open, stand: open, double: open && round.player.length === 2 };
}

export function hit(round: Round): Round {
  if (!allowedActions(round).hit) return round;
  const draw = drawer(round.shoe);
  const next: Round = { ...round, player: [...round.player, draw.next()], shoe: draw.shoe() };
  const { total } = handValue(next.player);
  if (total > 21) return { ...next, phase: 'done' };
  return total === 21 ? dealerPlays(next) : next;
}

export function stand(round: Round): Round {
  return allowedActions(round).stand ? dealerPlays(round) : round;
}

export function double(round: Round): Round {
  if (!allowedActions(round).double) return round;
  const draw = drawer(round.shoe);
  const next: Round = { ...round, player: [...round.player, draw.next()], shoe: draw.shoe(), doubled: true };
  return handValue(next.player).total > 21 ? { ...next, phase: 'done' } : dealerPlays(next);
}

/** The result once the round is done, else null. */
export function outcome(round: Round): Outcome | null {
  if (round.phase !== 'done') return null;
  const stake = round.doubled ? 2 : 1;
  const player = handValue(round.player).total;
  const dealer = handValue(round.dealer).total;
  const playerBj = isBlackjack(round.player);
  const dealerBj = isBlackjack(round.dealer);

  if (player > 21) return { result: 'bust', winner: 'bank', net: -stake };
  if (playerBj && dealerBj) return push();
  if (playerBj) return { result: 'blackjack', winner: 'player', net: 1.5 * stake };
  if (dealerBj || (dealer <= 21 && dealer > player)) return { result: 'lose', winner: 'bank', net: -stake };
  if (dealer > 21 || player > dealer) return { result: 'win', winner: 'player', net: stake };
  return push();
}

function push(): Outcome {
  return { result: 'push', winner: 'push', net: 0 };
}

function dealerPlays(round: Round): Round {
  const draw = drawer(round.shoe);
  const dealer = [...round.dealer];
  while (handValue(dealer).total < 17) dealer.push(draw.next());
  return { ...round, dealer, shoe: draw.shoe(), phase: 'done' };
}

function drawer(shoe: Shoe): { next: () => Card; shoe: () => Shoe } {
  const cards = [...shoe.cards];
  return {
    next: () => {
      const card = cards.pop();
      if (!card) throw new Error('shoe is empty');
      return card;
    },
    shoe: () => ({ cards, cutAt: shoe.cutAt }),
  };
}

function valueOf(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}
