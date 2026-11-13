/* Basic strategy (depends on table rules) and count-based index plays
 * (Illustrious 18 + Fab 4 surrenders, multi-deck values). Pure functions. */

export type Move = 'H' | 'S' | 'D' | 'P' | 'R';

export interface Rules {
  decks: number;
  h17: boolean; // dealer hits soft 17
  das: boolean; // double after split
  surrender: boolean; // late surrender
  penetration: number;
  seats: number; // AI players at the table (0–2)
  unit: number; // betting unit for the bet ramp
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  h17: false,
  das: true,
  surrender: true,
  penetration: 0.75,
  seats: 2,
  unit: 10,
};

export const MOVE_LABEL: Record<Move, string> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };

type C = { rank: string };

export function cardValue(card: C): number {
  if (card.rank === 'A') return 11;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === '10') return 10;
  return Number(card.rank);
}

export function hiLo(card: C): number {
  const v = cardValue(card);
  if (v >= 10) return -1;
  if (v <= 6) return 1;
  return 0;
}

export function handValue(cards: C[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else total += cardValue(c);
  }
  let soft = aces;
  while (total > 21 && soft > 0) {
    total -= 10;
    soft--;
  }
  return { total, soft: soft > 0 };
}

export function isBlackjack(cards: C[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export interface MoveOpts {
  canDouble?: boolean;
  canSplit?: boolean;
  canSurrender?: boolean;
  rules?: Partial<Rules>;
}

function isPair(cards: C[]) {
  return cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);
}

export function bestMove(cards: C[], upCard: C, opts: MoveOpts = {}): Move {
  const rules = { ...DEFAULT_RULES, ...opts.rules };
  const canDouble = opts.canDouble !== false;
  const canSplit = !!opts.canSplit;
  const canSurrender = !!opts.canSurrender && rules.surrender;
  const { total, soft } = handValue(cards);
  const d = cardValue(upCard);
  const dbl = (fallback: Move): Move => (canDouble ? 'D' : fallback);

  if (canSplit && isPair(cards)) {
    const p = cardValue(cards[0]);
    const das = rules.das;
    if (p === 11) return 'P';
    if (p === 8) {
      if (rules.h17 && d === 11 && canSurrender) return 'R';
      return 'P';
    }
    if (p === 10) return 'S';
    if (p === 9) return d === 7 || d === 10 || d === 11 ? 'S' : 'P';
    if (p === 7) return d <= 7 ? 'P' : 'H';
    if (p === 6) return (das ? d <= 6 : d >= 3 && d <= 6) ? 'P' : 'H';
    if (p === 4) return das && (d === 5 || d === 6) ? 'P' : 'H';
    if (p === 3 || p === 2) return (das ? d <= 7 : d >= 4 && d <= 7) ? 'P' : 'H';
    // 5,5 falls through and plays as hard 10
  }

  if (canSurrender && !soft && cards.length === 2) {
    if (total === 16 && (d === 9 || d === 10 || d === 11)) return 'R';
    if (total === 15 && (d === 10 || (rules.h17 && d === 11))) return 'R';
    if (total === 17 && rules.h17 && d === 11) return 'R';
  }

  if (soft) {
    if (total >= 20) return 'S';
    if (total === 19) return rules.h17 && d === 6 ? dbl('S') : 'S';
    if (total === 18) {
      if (d >= 9) return 'H';
      if (d >= 3 && d <= 6) return dbl('S');
      if (d === 2 && rules.h17) return dbl('S');
      return 'S';
    }
    if (total === 17) return d >= 3 && d <= 6 ? dbl('H') : 'H';
    if (total === 16 || total === 15) return d >= 4 && d <= 6 ? dbl('H') : 'H';
    if (total === 14 || total === 13) return d >= 5 && d <= 6 ? dbl('H') : 'H';
    return 'H';
  }

  if (total >= 17) return 'S';
  if (total >= 13) return d <= 6 ? 'S' : 'H';
  if (total === 12) return d >= 4 && d <= 6 ? 'S' : 'H';
  if (total === 11) return d === 11 && !rules.h17 ? 'H' : dbl('H');
  if (total === 10) return d <= 9 ? dbl('H') : 'H';
  if (total === 9) return d >= 3 && d <= 6 ? dbl('H') : 'H';
  return 'H';
}

/* ---------------- index plays ---------------- */

export interface IndexPlay {
  id: string;
  total?: number;
  pair?: number;
  up: number; // 11 = ace
  index: number;
  move: Move;
  /** 'above': play `move` at TC ≥ index. 'below': play `move` at TC < index. */
  when: 'above' | 'below';
}

export const FAB4: IndexPlay[] = [
  { id: '14v10R', total: 14, up: 10, index: 3, move: 'R', when: 'above' },
  { id: '15v10R', total: 15, up: 10, index: 0, move: 'R', when: 'above' },
  { id: '15v9R', total: 15, up: 9, index: 2, move: 'R', when: 'above' },
  { id: '15vAR', total: 15, up: 11, index: 1, move: 'R', when: 'above' },
];

export const ILLUSTRIOUS18: IndexPlay[] = [
  { id: '16v10', total: 16, up: 10, index: 0, move: 'S', when: 'above' },
  { id: '15v10', total: 15, up: 10, index: 4, move: 'S', when: 'above' },
  { id: 'TTv5', pair: 10, up: 5, index: 5, move: 'P', when: 'above' },
  { id: 'TTv6', pair: 10, up: 6, index: 4, move: 'P', when: 'above' },
  { id: '10v10', total: 10, up: 10, index: 4, move: 'D', when: 'above' },
  { id: '12v3', total: 12, up: 3, index: 2, move: 'S', when: 'above' },
  { id: '12v2', total: 12, up: 2, index: 3, move: 'S', when: 'above' },
  { id: '11vA', total: 11, up: 11, index: 1, move: 'D', when: 'above' },
  { id: '9v2', total: 9, up: 2, index: 1, move: 'D', when: 'above' },
  { id: '10vA', total: 10, up: 11, index: 4, move: 'D', when: 'above' },
  { id: '9v7', total: 9, up: 7, index: 3, move: 'D', when: 'above' },
  { id: '16v9', total: 16, up: 9, index: 5, move: 'S', when: 'above' },
  { id: '13v2', total: 13, up: 2, index: -1, move: 'H', when: 'below' },
  { id: '12v4', total: 12, up: 4, index: 0, move: 'H', when: 'below' },
  { id: '12v5', total: 12, up: 5, index: -2, move: 'H', when: 'below' },
  { id: '12v6', total: 12, up: 6, index: -1, move: 'H', when: 'below' },
  { id: '13v3', total: 13, up: 3, index: -2, move: 'H', when: 'below' },
];

export const INSURANCE_INDEX = 3;

export function playLabel(p: IndexPlay): string {
  const up = p.up === 11 ? 'A' : String(p.up);
  const hand = p.pair ? '10,10' : String(p.total);
  const sign = p.index > 0 ? `+${p.index}` : p.index < 0 ? `−${-p.index}` : '0';
  const cmp = p.when === 'above' ? '≥' : '<';
  return `${hand} vs ${up}: ${MOVE_LABEL[p.move]} at TC ${cmp} ${sign}`;
}

function matches(p: IndexPlay, cards: C[], d: number) {
  if (p.up !== d) return false;
  if (p.pair) return isPair(cards) && cardValue(cards[0]) === p.pair;
  const { total, soft } = handValue(cards);
  if (soft) return false;
  return total === p.total;
}

function allowed(move: Move, opts: MoveOpts) {
  if (move === 'D') return opts.canDouble !== false;
  if (move === 'P') return !!opts.canSplit;
  if (move === 'R') return !!opts.canSurrender;
  return true;
}

export interface CountMove {
  move: Move;
  basic: Move;
  play?: IndexPlay; // the index play that decided the move, if any
}

/** Basic strategy adjusted by the true count. */
export function countMove(cards: C[], upCard: C, tc: number, opts: MoveOpts = {}): CountMove {
  const basic = bestMove(cards, upCard, opts);
  const d = cardValue(upCard);
  const splitPairFirst = opts.canSplit && isPair(cards) && basic === 'P';

  if (opts.canSurrender && cards.length === 2 && !splitPairFirst) {
    for (const p of FAB4) {
      if (!matches(p, cards, d)) continue;
      if (tc >= p.index) return { move: 'R', basic, play: p };
      if (basic === 'R') {
        // basic says surrender, but the count is too low: play the hand out
        return { move: countMove(cards, upCard, tc, { ...opts, canSurrender: false }).move, basic, play: p };
      }
    }
  }
  if (basic === 'R') return { move: 'R', basic };
  if (splitPairFirst && !cards.every((c) => cardValue(c) === 10)) return { move: basic, basic };

  for (const p of ILLUSTRIOUS18) {
    if (!matches(p, cards, d)) continue;
    if (p.move === 'D' && cards.length !== 2) continue;
    const hit = p.when === 'above' ? tc >= p.index : tc < p.index;
    if (hit && allowed(p.move, opts)) return { move: p.move, basic, play: p };
    if (!hit && p.move === basic) {
      // the index says NOT to make the basic play at this count
      const alt: Move = p.move === 'S' ? 'H' : p.move === 'D' ? 'H' : p.move === 'P' ? 'S' : 'S';
      return { move: alt, basic, play: p };
    }
    return { move: basic, basic, play: undefined };
  }
  return { move: basic, basic };
}

/** Bet ramp: 1 unit below TC +2, then 2 units per true count above +1, capped at 8. */
export function suggestedUnits(tc: number): number {
  if (tc < 2) return 1;
  return Math.min(8, (Math.floor(tc) - 1) * 2);
}
