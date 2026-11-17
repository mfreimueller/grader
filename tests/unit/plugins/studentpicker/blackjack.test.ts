import {
  allowedActions,
  deal,
  double,
  handValue,
  hit,
  isBlackjack,
  needsShuffle,
  newShoe,
  outcome,
  stand,
  type Card,
  type Rank,
  type Round,
  type Shoe,
} from '../../../../plugins/studentpicker/src/core/blackjack';

function card(rank: Rank): Card {
  const value = rank === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(rank) ? 10 : Number(rank);
  return { rank, suit: '♠', value };
}

/** A shoe that deals the given ranks in this order and never needs a shuffle. */
function stacked(...ranks: Rank[]): Shoe {
  return { cards: ranks.map(card).reverse(), cutAt: 0 };
}

const noRandom = (): number => {
  throw new Error('random() must not be called');
};

/** Deals player, dealer up, player, dealer hole, then the rest in order. */
function dealt(...ranks: Rank[]): Round {
  return deal(stacked(...ranks), noRandom);
}

const ranks = (cards: readonly Card[]): string[] => cards.map((c) => c.rank);

describe('blackjack', () => {
  describe('newShoe', () => {
    it('holds six shuffled decks with the cut card at a quarter', () => {
      const shoe = newShoe(() => 0.5);
      expect(shoe.cards).toHaveLength(312);
      expect(shoe.cutAt).toBe(78);
      expect(shoe.cards.filter((c) => c.rank === 'A' && c.suit === '♥')).toHaveLength(6);
      expect(shoe.cards.filter((c) => c.value === 10)).toHaveLength(96);
    });

    it('shuffles with the given random', () => {
      const fixed = newShoe(() => 0.999).cards.map((c) => c.rank + c.suit);
      const other = newShoe(() => 0).cards.map((c) => c.rank + c.suit);
      expect(fixed).not.toEqual(other);
    });
  });

  describe('needsShuffle', () => {
    it('is true once the shoe is down to the cut card', () => {
      expect(needsShuffle({ cards: [card('2')], cutAt: 1 })).toBe(true);
      expect(needsShuffle({ cards: [card('2'), card('3')], cutAt: 1 })).toBe(false);
    });
  });

  describe('handValue', () => {
    it('adds the cards', () => {
      expect(handValue([card('9'), card('K')])).toEqual({ total: 19, soft: false });
    });

    it('counts one ace as 11 while that stays at 21 or below', () => {
      expect(handValue([card('A'), card('6')])).toEqual({ total: 17, soft: true });
      expect(handValue([card('A'), card('A'), card('9')])).toEqual({ total: 21, soft: true });
    });

    it('counts aces as 1 when 11 would bust', () => {
      expect(handValue([card('A'), card('6'), card('9')])).toEqual({ total: 16, soft: false });
    });
  });

  describe('isBlackjack', () => {
    it('is an ace and a ten-value card as the first two cards', () => {
      expect(isBlackjack([card('A'), card('Q')])).toBe(true);
      expect(isBlackjack([card('7'), card('7'), card('7')])).toBe(false);
      expect(isBlackjack([card('9'), card('Q')])).toBe(false);
    });
  });

  describe('deal', () => {
    it('deals player, dealer, player, dealer and waits for the player', () => {
      const round = dealt('9', '6', '7', 'K', '5');
      expect(ranks(round.player)).toEqual(['9', '7']);
      expect(ranks(round.dealer)).toEqual(['6', 'K']);
      expect(round.phase).toBe('player');
      expect(round.shoe.cards).toHaveLength(1);
      expect(outcome(round)).toBeNull();
    });

    it('shuffles a new shoe first when the cut card is reached', () => {
      const round = deal({ cards: [card('2')], cutAt: 1 }, () => 0.5);
      expect(round.shoe.cards).toHaveLength(312 - 4);
    });

    it('ends at once on a player blackjack', () => {
      const round = dealt('A', '9', 'K', '7');
      expect(round.phase).toBe('done');
      expect(outcome(round)).toEqual({ result: 'blackjack', winner: 'player', net: 1.5 });
    });

    it('ends at once on a dealer blackjack', () => {
      const round = dealt('9', 'A', '9', 'K');
      expect(round.phase).toBe('done');
      expect(outcome(round)).toEqual({ result: 'lose', winner: 'bank', net: -1 });
    });

    it('is a push when both have blackjack', () => {
      expect(outcome(dealt('A', 'A', 'K', 'Q'))).toEqual({ result: 'push', winner: 'push', net: 0 });
    });
  });

  describe('allowedActions', () => {
    it('allows hit, stand and double on the first two cards', () => {
      expect(allowedActions(dealt('9', '6', '2', 'K'))).toEqual({ hit: true, stand: true, double: true });
    });

    it('allows no double after a hit', () => {
      expect(allowedActions(hit(dealt('5', '6', '2', 'K', '3')))).toEqual({ hit: true, stand: true, double: false });
    });

    it('allows nothing once the round is done', () => {
      expect(allowedActions(dealt('A', '9', 'K', '7'))).toEqual({ hit: false, stand: false, double: false });
    });
  });

  describe('hit', () => {
    it('gives the player one more card', () => {
      const round = hit(dealt('5', '6', '2', 'K', '3'));
      expect(ranks(round.player)).toEqual(['5', '2', '3']);
      expect(round.phase).toBe('player');
    });

    it('ends the round when the player busts, without the dealer drawing', () => {
      const round = hit(dealt('K', '6', '6', 'K', '9', '5'));
      expect(round.phase).toBe('done');
      expect(ranks(round.dealer)).toEqual(['6', 'K']);
      expect(outcome(round)).toEqual({ result: 'bust', winner: 'bank', net: -1 });
    });

    it('stands on its own at 21 and lets the dealer play', () => {
      const round = hit(dealt('9', '6', '2', 'K', 'K', 'Q'));
      expect(round.phase).toBe('done');
      expect(outcome(round)).toEqual({ result: 'win', winner: 'player', net: 1 });
    });

    it('changes nothing once the round is done', () => {
      const done = dealt('A', '9', 'K', '7');
      expect(hit(done)).toBe(done);
    });
  });

  describe('stand', () => {
    it('lets the dealer draw to 17 and compares', () => {
      const round = stand(dealt('K', '6', '9', '4', '5', '5'));
      expect(ranks(round.dealer)).toEqual(['6', '4', '5', '5']);
      expect(outcome(round)).toEqual({ result: 'lose', winner: 'bank', net: -1 });
    });

    it('lets the dealer stand on soft 17', () => {
      const round = stand(dealt('K', 'A', '8', '6', '5'));
      expect(ranks(round.dealer)).toEqual(['A', '6']);
      expect(outcome(round)).toEqual({ result: 'win', winner: 'player', net: 1 });
    });

    it('is a win when the dealer busts', () => {
      const round = stand(dealt('K', '6', '2', 'K', '9'));
      expect(outcome(round)).toEqual({ result: 'win', winner: 'player', net: 1 });
    });

    it('is a push on equal totals', () => {
      expect(outcome(stand(dealt('K', '9', '9', 'K')))).toEqual({ result: 'push', winner: 'push', net: 0 });
    });

    it('changes nothing once the round is done', () => {
      const done = dealt('A', '9', 'K', '7');
      expect(stand(done)).toBe(done);
    });
  });

  describe('double', () => {
    it('takes exactly one card at a double stake and lets the dealer play', () => {
      const round = double(dealt('5', '6', '6', 'K', '9', 'Q'));
      expect(ranks(round.player)).toEqual(['5', '6', '9']);
      expect(round.doubled).toBe(true);
      expect(round.phase).toBe('done');
      expect(outcome(round)).toEqual({ result: 'win', winner: 'player', net: 2 });
    });

    it('loses twice the stake on a bust', () => {
      const round = double(dealt('9', '6', '5', 'K', 'Q'));
      expect(outcome(round)).toEqual({ result: 'bust', winner: 'bank', net: -2 });
    });

    it('is refused after a hit', () => {
      const afterHit = hit(dealt('5', '6', '2', 'K', '3'));
      expect(double(afterHit)).toBe(afterHit);
    });
  });

  describe('drawing from an empty shoe', () => {
    it('throws, because the cut card leaves enough cards for a whole round', () => {
      expect(() => dealt('9', '6', '7')).toThrow('shoe is empty');
    });
  });
});
