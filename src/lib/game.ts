/* Blackjack rules and state. No React or Three dependency:
 * the UI and the scene react to hooks and read the public fields. */

import {
  DEFAULT_RULES,
  INSURANCE_INDEX,
  MOVE_LABEL,
  bestMove,
  cardValue,
  countMove,
  handValue,
  hiLo,
  isBlackjack,
  playLabel,
  suggestedUnits,
  type CountMove,
  type Move,
  type Rules,
} from './strategy.ts';

export {
  DEFAULT_RULES,
  FAB4,
  ILLUSTRIOUS18,
  INSURANCE_INDEX,
  MOVE_LABEL,
  bestMove,
  cardValue,
  countMove,
  handValue,
  hiLo,
  isBlackjack,
  playLabel,
  suggestedUnits,
} from './strategy.ts';
export type { CountMove, IndexPlay, Move, Rules } from './strategy.ts';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['♠', '♥', '♦', '♣'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Tone = 'win' | 'loss' | 'push' | '';
export type Phase = 'bet' | 'insurance' | 'player' | 'dealer' | 'settle' | 'quiz';
export type Mode = 'classic' | 'count';
export type Quality = 'high' | 'medium' | 'low';

export interface Card {
  id: number;
  rank: Rank;
  suit: Suit;
  faceUp: boolean;
  counted: boolean;
}

export interface Hand {
  cards: Card[];
  bet: number;
  done: boolean;
  doubled: boolean;
  fromSplit: boolean;
  fromSplitAces: boolean;
  surrendered: boolean;
  insurance: number;
  result?: string;
  resultTone?: Tone;
}

/** An AI player. `side` 1 sits at first base (acts before you), −1 at third base. */
export interface Seat {
  id: number;
  name: string;
  side: 1 | -1;
  style: 'basic' | 'counter';
  cards: Card[];
  bet: number;
  done: boolean;
  doubled: boolean;
  result?: string;
  resultTone?: Tone;
}

export interface DealMeta {
  to: 'player' | 'dealer' | 'seat';
  /** player: hand index · seat: index in `seats` · dealer: −1 */
  hand: number;
  index: number;
  faceUp: boolean;
}

export interface Quiz {
  answer: number;
  done: boolean;
  guess: number | null;
  ok: boolean | null;
}

export interface Stats {
  quizRight: number;
  quizWrong: number;
  stratRight: number;
  stratWrong: number;
  devRight: number;
  devWrong: number;
  betRight: number;
  betWrong: number;
  insRight: number;
  insWrong: number;
  tcRight: number;
  tcWrong: number;
  countdownBest: number | null;
  countdownRuns: number;
  hands: number;
  bestRun: number;
  run: number;
}

export interface HistoryPoint {
  n: number;
  bankroll: number;
  net: number;
  bet: number;
  tc: number;
}

export interface Coach {
  move: Move;
  note?: string;
}

export interface GameHooks {
  onCount?: (card: Card, value: number, running: number) => void;
  onHud?: () => void;
  onPhase?: () => void;
  onToast?: (text: string) => void;
  onCoach?: (c: Coach) => void;
  onShoeReset?: () => void;
  onDeal?: (card: Card, meta: DealMeta) => Promise<void> | void;
  onReveal?: (card: Card, meta: { index: number }) => Promise<void> | void;
  onSplit?: (handIndex: number) => Promise<void> | void;
  onRoundStart?: () => Promise<void> | void;
  onSeatTurn?: (seat: Seat) => Promise<void> | void;
  onSettle?: (r: { net: number; tone: Tone; dealer: Card[]; hands: Hand[] }) => Promise<void> | void;
  onShuffle?: () => Promise<void> | void;
  onQuiz?: (q: Quiz) => void;
}

export function defaultStats(): Stats {
  return {
    quizRight: 0,
    quizWrong: 0,
    stratRight: 0,
    stratWrong: 0,
    devRight: 0,
    devWrong: 0,
    betRight: 0,
    betWrong: 0,
    insRight: 0,
    insWrong: 0,
    tcRight: 0,
    tcWrong: 0,
    countdownBest: null,
    countdownRuns: 0,
    hands: 0,
    bestRun: 0,
    run: 0,
  };
}

const STORE_KEY = 'countlab.forge.v1';
const HISTORY_MAX = 300;
const START_BANKROLL = 1000;

const SEAT_PRESETS: Omit<Seat, 'cards' | 'bet' | 'done' | 'doubled'>[] = [
  { id: 1, name: 'Ava', side: 1, style: 'basic' },
  { id: 2, name: 'Rook', side: -1, style: 'counter' },
];

function loadStore(): Record<string, unknown> {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(STORE_KEY) ?? 'null') || {};
  } catch {
    return {};
  }
}

function newHand(bet: number, extra: Partial<Hand> = {}): Hand {
  return {
    cards: [],
    bet,
    done: false,
    doubled: false,
    fromSplit: false,
    fromSplitAces: false,
    surrendered: false,
    insurance: 0,
    ...extra,
  };
}

let nextCardId = 1;

export class Game {
  hooks: GameHooks;
  rules: Rules;
  bankroll: number;
  mode: Mode;
  showCount: boolean;
  coach: boolean;
  drill: boolean;
  quality: Quality;
  haptics: boolean;
  stats: Stats;
  history: HistoryPoint[];
  bet = 10;
  phase: Phase = 'bet';
  dealer: Card[] = [];
  hands: Hand[] = [];
  seats: Seat[] = [];
  active = 0;
  /** index in `seats` of the AI player acting now, or −1 */
  actingSeat = -1;
  running = 0;
  roundCards: Card[] = [];
  banner = 'Place your bet';
  bannerTone: Tone = '';
  quiz: Quiz | null = null;
  shoe: Omit<Card, 'id' | 'faceUp' | 'counted'>[];
  busy = false;
  quizTimer: ReturnType<typeof setTimeout> | undefined;
  /** true count when the current round's bets were placed */
  betTc = 0;

  constructor({ bankroll = START_BANKROLL, hooks = {}, rules = {} }: { bankroll?: number; hooks?: GameHooks; rules?: Partial<Rules> } = {}) {
    this.hooks = hooks;
    const saved = loadStore();

    this.rules = { ...DEFAULT_RULES, ...((saved.rules as Partial<Rules>) || {}), ...rules };
    this.bankroll = typeof saved.bankroll === 'number' ? saved.bankroll : bankroll;
    this.mode = saved.mode === 'classic' ? 'classic' : 'count';
    this.showCount = saved.showCount !== false;
    this.coach = saved.coach !== false;
    this.drill = saved.drill !== false;
    this.quality = saved.quality === 'medium' || saved.quality === 'low' ? saved.quality : 'high';
    this.haptics = saved.haptics !== false;
    this.stats = { ...defaultStats(), ...((saved.stats as Partial<Stats>) || {}) };
    this.history = Array.isArray(saved.history) ? (saved.history as HistoryPoint[]).slice(-HISTORY_MAX) : [];
    this.bet = Math.max(5, Math.min(this.rules.unit, this.bankroll));
    this.shoe = this.buildShoe();
    this.seats = this.makeSeats();
  }

  get decks() {
    return this.rules.decks;
  }

  get penetration() {
    return this.rules.penetration;
  }

  save() {
    try {
      globalThis.localStorage?.setItem(
        STORE_KEY,
        JSON.stringify({
          bankroll: this.bankroll,
          mode: this.mode,
          showCount: this.showCount,
          coach: this.coach,
          drill: this.drill,
          quality: this.quality,
          haptics: this.haptics,
          rules: this.rules,
          stats: this.stats,
          history: this.history,
        })
      );
    } catch {
      /* quota */
    }
  }

  /* ---------------- shoe and count ---------------- */

  buildShoe() {
    const cards: { rank: Rank; suit: Suit }[] = [];
    for (let d = 0; d < this.rules.decks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) cards.push({ rank, suit });
      }
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  decksLeft() {
    return Math.max(0.15, this.shoe.length / 52);
  }

  trueCount() {
    return this.running / this.decksLeft();
  }

  draw(faceUp: boolean): Card {
    if (!this.shoe.length) this.resetShoe();
    const card = this.shoe.pop()!;
    const drawn: Card = { ...card, id: nextCardId++, faceUp: !!faceUp, counted: false };
    if (faceUp) this.countCard(drawn);
    return drawn;
  }

  countCard(card: Card) {
    if (card.counted) return;
    card.counted = true;
    this.running += hiLo(card);
    this.roundCards.push(card);
    this.hooks.onCount?.(card, hiLo(card), this.running);
    this.hooks.onHud?.();
  }

  resetShoe() {
    this.shoe = this.buildShoe();
    this.running = 0;
    this.roundCards = [];
    this.hooks.onShoeReset?.();
    this.hooks.onHud?.();
  }

  needsShuffle() {
    return this.shoe.length < Math.round(this.rules.decks * 52 * (1 - this.rules.penetration));
  }

  cardsOnTable() {
    return this.dealer.length + this.hands.reduce((a, h) => a + h.cards.length, 0) + this.seats.reduce((a, s) => a + s.cards.length, 0);
  }

  /* ---------------- settings ---------------- */

  makeSeats(): Seat[] {
    const n = Math.max(0, Math.min(2, this.rules.seats));
    return SEAT_PRESETS.slice(0, n).map((p) => ({ ...p, cards: [], bet: 0, done: false, doubled: false }));
  }

  /** Rules change only between rounds. Returns false when not allowed now. */
  setRules(patch: Partial<Rules>): boolean {
    if (this.phase !== 'bet' || this.busy) return false;
    const prev = this.rules;
    this.rules = { ...prev, ...patch };
    if (prev.decks !== this.rules.decks || prev.penetration !== this.rules.penetration) {
      this.resetShoe();
      this.hooks.onToast?.('New shoe: count reset to zero');
    }
    if (prev.seats !== this.rules.seats) this.seats = this.makeSeats();
    this.save();
    this.hooks.onHud?.();
    this.hooks.onPhase?.();
    return true;
  }

  resetStats() {
    this.stats = defaultStats();
    this.history = [];
    this.save();
    this.hooks.onHud?.();
  }

  resetBankroll() {
    if (this.phase !== 'bet') return;
    this.bankroll = START_BANKROLL;
    this.bet = Math.min(this.bet, this.bankroll);
    this.save();
    this.hooks.onHud?.();
  }

  /* ---------------- betting ---------------- */

  setBet(amount: number) {
    if (this.phase !== 'bet') return;
    const next = this.bet + amount;
    if (next > this.bankroll || next <= 0) {
      this.hooks.onToast?.('Bet exceeds your bankroll');
      return;
    }
    this.bet = next;
    this.hooks.onHud?.();
  }

  setBetExact(amount: number) {
    if (this.phase !== 'bet') return;
    this.bet = Math.max(5, Math.min(Math.round(amount), this.bankroll));
    this.hooks.onHud?.();
  }

  minBet() {
    if (this.phase !== 'bet') return;
    this.bet = Math.max(5, Math.min(this.rules.unit, this.bankroll));
    this.hooks.onHud?.();
  }

  /** What the bet ramp asks for at the current true count. */
  suggestedBet() {
    const units = this.mode === 'count' ? suggestedUnits(this.trueCount()) : 1;
    return Math.max(5, Math.min(this.bankroll, this.rules.unit * units));
  }

  judgeBet() {
    if (!this.coach || this.mode !== 'count') return;
    const expected = this.suggestedBet();
    if (this.bet === expected) this.stats.betRight++;
    else {
      this.stats.betWrong++;
      this.hooks.onToast?.(`Bet ramp: ${money(expected)} at TC ${fmtTc(this.trueCount())}`);
    }
  }

  /* ---------------- player decisions ---------------- */

  currentHand(): Hand | undefined {
    return this.hands[this.active];
  }

  canAct() {
    const h = this.currentHand();
    return this.phase === 'player' && !!h && !h.done && !this.busy && handValue(h.cards).total <= 21;
  }

  canDouble() {
    const h = this.currentHand();
    if (!this.canAct() || !h || h.cards.length !== 2 || h.fromSplitAces) return false;
    if (h.fromSplit && !this.rules.das) return false;
    return this.bankroll >= h.bet;
  }

  canSplit() {
    const h = this.currentHand();
    if (!this.canAct() || !h || h.cards.length !== 2 || this.hands.length >= 4) return false;
    if (h.fromSplitAces) return false;
    if (cardValue(h.cards[0]) !== cardValue(h.cards[1])) return false;
    return this.bankroll >= h.bet;
  }

  canSurrender() {
    const h = this.currentHand();
    return this.rules.surrender && this.canAct() && !!h && h.cards.length === 2 && this.hands.length === 1 && !h.fromSplit;
  }

  insuranceCost() {
    const h = this.hands[0];
    return h ? h.bet / 2 : 0;
  }

  /** The move the coach wants now: basic strategy, or count-adjusted in count mode. */
  expected(): CountMove | null {
    const h = this.currentHand();
    if (!h || this.phase !== 'player' || !this.dealer[0]) return null;
    const opts = { canDouble: this.canDouble(), canSplit: this.canSplit(), canSurrender: this.canSurrender(), rules: this.rules };
    if (this.mode === 'count') return countMove(h.cards, this.dealer[0], this.trueCount(), opts);
    const basic = bestMove(h.cards, this.dealer[0], opts);
    return { move: basic, basic };
  }

  emitCoach() {
    const e = this.expected();
    if (!e) return;
    this.hooks.onCoach?.({ move: e.move, note: e.play && e.move !== e.basic ? playLabel(e.play) : undefined });
  }

  judge(action: Move) {
    if (!this.coach) return;
    const e = this.expected();
    if (!e) return;
    const ok = action === e.move;
    const deviation = e.move !== e.basic;
    if (deviation) {
      if (ok) this.stats.devRight++;
      else this.stats.devWrong++;
    } else if (ok) this.stats.stratRight++;
    else this.stats.stratWrong++;

    if (!ok) {
      if (deviation && e.play) this.hooks.onToast?.(`Count play: ${MOVE_LABEL[e.move]} · ${playLabel(e.play)}`);
      else this.hooks.onToast?.(`Basic strategy says: ${MOVE_LABEL[e.move]}`);
    }
    this.save();
  }

  /* ---------------- round flow ---------------- */

  async startHand() {
    if (this.phase !== 'bet' || this.busy) return;
    if (this.bet > this.bankroll) {
      this.hooks.onToast?.('Not enough bankroll');
      return;
    }

    this.busy = true;
    if (this.needsShuffle()) {
      await this.hooks.onShuffle?.();
      this.resetShoe();
      this.hooks.onToast?.('Shoe reshuffled: count reset to zero');
    }

    this.judgeBet();
    this.betTc = this.trueCount();
    this.bankroll -= this.bet;
    this.phase = 'player';
    this.dealer = [];
    this.hands = [newHand(this.bet)];
    this.active = 0;
    this.actingSeat = -1;
    this.roundCards = [];
    this.quiz = null;
    this.banner = 'Dealing…';
    this.bannerTone = '';
    this.stats.hands++;

    const unit = this.rules.unit;
    for (const s of this.seats) {
      s.cards = [];
      s.done = false;
      s.doubled = false;
      s.result = undefined;
      s.resultTone = undefined;
      s.bet = s.style === 'counter' ? unit * suggestedUnits(this.betTc) : unit * (1 + Math.floor(Math.random() * 3));
    }

    this.hooks.onHud?.();
    this.hooks.onPhase?.();
    await this.hooks.onRoundStart?.();

    // dealing order: first base → you → third base → dealer, twice
    const order = [...this.seats.map((s, i) => ({ s, i })).filter((x) => x.s.side === 1), null, ...this.seats.map((s, i) => ({ s, i })).filter((x) => x.s.side === -1)];
    const h = this.hands[0];
    for (let round = 0; round < 2; round++) {
      for (const o of order) {
        const card = this.draw(true);
        if (o) {
          o.s.cards.push(card);
          await this.hooks.onDeal?.(card, { to: 'seat', hand: o.i, index: round, faceUp: true });
        } else {
          h.cards.push(card);
          await this.hooks.onDeal?.(card, { to: 'player', hand: 0, index: round, faceUp: true });
        }
      }
      const d = this.draw(round === 0);
      this.dealer.push(d);
      await this.hooks.onDeal?.(d, { to: 'dealer', hand: -1, index: round, faceUp: round === 0 });
    }
    for (const s of this.seats) if (isBlackjack(s.cards)) s.done = true;

    this.busy = false;

    if (cardValue(this.dealer[0]) === 11) {
      this.phase = 'insurance';
      this.banner = isBlackjack(h.cards) ? 'Even money?' : 'Insurance?';
      this.hooks.onHud?.();
      this.hooks.onPhase?.();
      return;
    }
    await this.afterPeek();
  }

  async insurance(take: boolean) {
    if (this.phase !== 'insurance' || this.busy) return;
    const h = this.hands[0];
    const cost = this.insuranceCost();
    if (take) {
      if (this.bankroll < cost) {
        this.hooks.onToast?.('Not enough bankroll for insurance');
        return;
      }
      this.bankroll -= cost;
      h.insurance = cost;
    }
    if (this.coach) {
      const tc = this.trueCount();
      const should = this.mode === 'count' && tc >= INSURANCE_INDEX;
      if (take === should) this.stats.insRight++;
      else {
        this.stats.insWrong++;
        this.hooks.onToast?.(
          should
            ? `Take insurance at TC ≥ +${INSURANCE_INDEX} (now ${fmtTc(tc)})`
            : this.mode === 'count'
              ? `Insurance only pays off at TC ≥ +${INSURANCE_INDEX} (now ${fmtTc(tc)})`
              : 'Basic strategy never takes insurance'
        );
      }
    }
    this.hooks.onHud?.();
    await this.afterPeek();
  }

  /** The dealer has checked for blackjack (up card 10 or A). */
  async afterPeek() {
    const h = this.hands[0];
    this.phase = 'player';
    this.banner = 'Your turn';
    this.hooks.onHud?.();

    if (isBlackjack(this.dealer)) {
      await this.revealAll();
      await this.settle();
      return;
    }
    if (h.insurance) this.hooks.onToast?.('No dealer blackjack · insurance lost');

    await this.playSeats(1);
    if (isBlackjack(h.cards)) {
      h.done = true;
      await this.advance();
      return;
    }
    this.banner = 'Your turn';
    this.hooks.onHud?.();
    this.hooks.onPhase?.();
    this.emitCoach();
  }

  /** AI players on one side of you play their hands. */
  async playSeats(side: 1 | -1) {
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      if (s.side !== side) continue;
      if (s.done) continue;
      this.busy = true;
      this.actingSeat = i;
      this.banner = `${s.name} plays`;
      this.hooks.onHud?.();
      this.hooks.onPhase?.();
      await this.hooks.onSeatTurn?.(s);
      let guard = 0;
      while (guard++ < 10 && handValue(s.cards).total < 21) {
        const opts = { canDouble: s.cards.length === 2, canSplit: false, canSurrender: false, rules: this.rules };
        const move = s.style === 'counter' ? countMove(s.cards, this.dealer[0], this.trueCount(), opts).move : bestMove(s.cards, this.dealer[0], opts);
        if (move !== 'H' && move !== 'D') break;
        if (move === 'D') {
          s.bet *= 2;
          s.doubled = true;
        }
        const card = this.draw(true);
        s.cards.push(card);
        await this.hooks.onDeal?.(card, { to: 'seat', hand: i, index: s.cards.length - 1, faceUp: true });
        if (move === 'D') break;
      }
      s.done = true;
      this.actingSeat = -1;
      this.busy = false;
      this.hooks.onHud?.();
    }
  }

  async revealAll() {
    for (let i = 0; i < this.dealer.length; i++) {
      const c = this.dealer[i];
      if (!c.faceUp) {
        c.faceUp = true;
        this.countCard(c);
        await this.hooks.onReveal?.(c, { index: i });
        this.hooks.onHud?.();
      }
    }
  }

  async hit() {
    if (!this.canAct()) return;
    this.judge('H');
    this.busy = true;
    this.hooks.onPhase?.();
    const h = this.currentHand()!;
    const card = this.draw(true);
    h.cards.push(card);
    await this.hooks.onDeal?.(card, { to: 'player', hand: this.active, index: h.cards.length - 1, faceUp: true });
    this.hooks.onHud?.();
    this.busy = false;
    if (handValue(h.cards).total >= 21) {
      h.done = true;
      await this.advance();
    } else {
      this.hooks.onPhase?.();
      this.emitCoach();
    }
  }

  async stand() {
    if (!this.canAct()) return;
    this.judge('S');
    this.currentHand()!.done = true;
    await this.advance();
  }

  async surrender() {
    if (!this.canSurrender()) return;
    this.judge('R');
    const h = this.currentHand()!;
    h.surrendered = true;
    h.done = true;
    await this.advance();
  }

  async double() {
    if (!this.canDouble()) return;
    this.judge('D');
    const h = this.currentHand()!;
    this.busy = true;
    this.bankroll -= h.bet;
    h.bet *= 2;
    h.doubled = true;
    this.hooks.onPhase?.();
    const card = this.draw(true);
    h.cards.push(card);
    await this.hooks.onDeal?.(card, { to: 'player', hand: this.active, index: h.cards.length - 1, faceUp: true });
    h.done = true;
    this.hooks.onHud?.();
    this.busy = false;
    await this.advance();
  }

  async split() {
    if (!this.canSplit()) return;
    this.judge('P');
    const h = this.currentHand()!;
    this.busy = true;
    const moved = h.cards.pop()!;
    this.bankroll -= h.bet;

    const aceSplit = cardValue(moved) === 11;
    const added = newHand(h.bet, { cards: [moved], fromSplit: true, fromSplitAces: aceSplit });
    h.fromSplit = true;
    h.fromSplitAces = aceSplit;
    this.hands.splice(this.active + 1, 0, added);

    this.hooks.onHud?.();
    await this.hooks.onSplit?.(this.active);

    const c1 = this.draw(true);
    h.cards.push(c1);
    await this.hooks.onDeal?.(c1, { to: 'player', hand: this.active, index: 1, faceUp: true });

    const c2 = this.draw(true);
    added.cards.push(c2);
    await this.hooks.onDeal?.(c2, { to: 'player', hand: this.active + 1, index: 1, faceUp: true });

    if (aceSplit) {
      h.done = true;
      added.done = true;
      this.busy = false;
      await this.advance();
      return;
    }
    if (handValue(h.cards).total === 21) h.done = true;
    this.busy = false;
    if (h.done) await this.advance();
    else {
      this.hooks.onPhase?.();
      this.emitCoach();
    }
  }

  async advance(): Promise<void> {
    this.busy = true;
    this.hooks.onPhase?.();
    let i = this.active + 1;
    while (i < this.hands.length && this.hands[i].done) i++;

    if (i < this.hands.length) {
      this.active = i;
      const h = this.hands[i];
      if (h.fromSplitAces || handValue(h.cards).total >= 21) {
        h.done = true;
        this.busy = false;
        await this.advance();
        return;
      }
      this.busy = false;
      this.hooks.onPhase?.();
      this.emitCoach();
      return;
    }

    this.busy = false;
    await this.playSeats(-1);
    await this.dealerTurn();
  }

  dealerHits() {
    const v = handValue(this.dealer);
    return v.total < 17 || (v.total === 17 && v.soft && this.rules.h17);
  }

  async dealerTurn() {
    this.phase = 'dealer';
    this.banner = "Dealer's turn";
    this.hooks.onHud?.();
    this.hooks.onPhase?.();
    await this.revealAll();

    const alive =
      this.hands.some((h) => !h.surrendered && handValue(h.cards).total <= 21 && !(isBlackjack(h.cards) && !h.fromSplit)) ||
      this.seats.some((s) => handValue(s.cards).total <= 21 && !isBlackjack(s.cards));
    if (alive) {
      let guard = 0;
      while (this.dealerHits() && guard++ < 16) {
        const card = this.draw(true);
        this.dealer.push(card);
        await this.hooks.onDeal?.(card, { to: 'dealer', hand: -1, index: this.dealer.length - 1, faceUp: true });
        this.hooks.onHud?.();
      }
    }
    await this.settle();
  }

  /** Result of one hand against the dealer: payout multiplier on the bet and a label. */
  outcome(cards: Card[], natural: boolean): { mult: number; result: string; tone: Tone } {
    const pv = handValue(cards).total;
    const dv = handValue(this.dealer).total;
    const dealerBJ = isBlackjack(this.dealer);
    const playerBJ = natural && isBlackjack(cards);
    if (pv > 21) return { mult: 0, result: 'bust', tone: 'loss' };
    if (playerBJ && !dealerBJ) return { mult: 2.5, result: 'blackjack', tone: 'win' };
    if (dealerBJ) return playerBJ ? { mult: 1, result: 'push', tone: 'push' } : { mult: 0, result: 'lose', tone: 'loss' };
    if (dv > 21) return { mult: 2, result: 'dealer bust', tone: 'win' };
    if (pv > dv) return { mult: 2, result: 'win', tone: 'win' };
    if (pv === dv) return { mult: 1, result: 'push', tone: 'push' };
    return { mult: 0, result: 'lose', tone: 'loss' };
  }

  async settle() {
    this.phase = 'settle';
    this.actingSeat = -1;
    const dealerBJ = isBlackjack(this.dealer);
    let net = 0;
    let wagered = 0;

    for (const h of this.hands) {
      let payout = 0;
      if (h.surrendered) {
        payout = h.bet / 2;
        h.result = 'surrender';
        h.resultTone = 'loss';
      } else {
        const o = this.outcome(h.cards, !h.fromSplit);
        payout = h.bet * o.mult;
        h.result = o.result;
        h.resultTone = o.tone;
      }
      if (h.insurance && dealerBJ) payout += h.insurance * 3;
      this.bankroll += payout;
      net += payout - h.bet - h.insurance;
      wagered += h.bet;
    }

    for (const s of this.seats) {
      if (!s.cards.length) continue;
      const o = this.outcome(s.cards, true);
      s.result = o.result;
      s.resultTone = o.tone;
    }

    if (net > 0) {
      this.banner = `You won ${money(net)}`;
      this.bannerTone = 'win';
    } else if (net < 0) {
      this.banner = `You lost ${money(-net)}`;
      this.bannerTone = 'loss';
    } else {
      this.banner = 'Push, bet returned';
      this.bannerTone = 'push';
    }
    if (dealerBJ && this.hands[0]?.insurance) this.banner += ' · insurance paid';

    this.history.push({ n: this.stats.hands, bankroll: this.bankroll, net, bet: wagered, tc: Math.round(this.betTc * 10) / 10 });
    if (this.history.length > HISTORY_MAX) this.history.splice(0, this.history.length - HISTORY_MAX);

    if (this.bankroll < 5) {
      this.bankroll = 500;
      this.banner = `Bankroll empty · reloaded ${money(500)}`;
      this.bannerTone = 'push';
    }

    this.save();
    this.hooks.onHud?.();
    this.hooks.onPhase?.();
    await this.hooks.onSettle?.({ net, tone: this.bannerTone, dealer: this.dealer, hands: this.hands });

    if (this.drill && this.mode === 'count') {
      clearTimeout(this.quizTimer);
      this.quizTimer = setTimeout(() => {
        if (this.phase !== 'settle') return;
        this.quiz = { answer: this.running, done: false, guess: null, ok: null };
        this.phase = 'quiz';
        this.hooks.onPhase?.();
        this.hooks.onQuiz?.(this.quiz);
      }, 900);
    }
  }

  answerQuiz(raw: string): Quiz | null {
    const q = this.quiz;
    if (!q || q.done) return null;
    const guess = parseCount(raw);
    if (guess === null) return null;
    q.guess = guess;
    q.ok = guess === q.answer;
    q.done = true;

    if (q.ok) {
      this.stats.quizRight++;
      this.stats.run++;
      this.stats.bestRun = Math.max(this.stats.bestRun, this.stats.run);
    } else {
      this.stats.quizWrong++;
      this.stats.run = 0;
    }
    this.save();
    this.hooks.onHud?.();
    return q;
  }

  closeQuiz() {
    clearTimeout(this.quizTimer);
    this.quiz = null;
    this.phase = 'settle';
    this.hooks.onPhase?.();
  }

  nextHand() {
    if (this.phase !== 'settle') return;
    clearTimeout(this.quizTimer);
    this.phase = 'bet';
    this.dealer = [];
    this.hands = [];
    for (const s of this.seats) {
      s.cards = [];
      s.bet = 0;
      s.result = undefined;
      s.resultTone = undefined;
    }
    this.active = 0;
    this.quiz = null;
    this.banner = 'Place your bet';
    this.bannerTone = '';
    if (this.bet > this.bankroll) this.bet = Math.max(5, Math.min(this.bet, this.bankroll));
    this.hooks.onHud?.();
    this.hooks.onPhase?.();
  }

  /* ---------------- drill results ---------------- */

  recordTcDrill(ok: boolean) {
    if (ok) this.stats.tcRight++;
    else this.stats.tcWrong++;
    this.save();
  }

  recordCountdown(seconds: number, ok: boolean) {
    this.stats.countdownRuns++;
    if (ok && (this.stats.countdownBest === null || seconds < this.stats.countdownBest)) this.stats.countdownBest = seconds;
    this.save();
  }
}

export function parseCount(raw: string): number | null {
  const cleaned = String(raw).trim().replace(/[−–]/g, '-').replace(/[^0-9+\-]/g, '');
  if (cleaned === '' || cleaned === '+' || cleaned === '-') return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

export function money(n: number): string {
  const r = Math.round(n * 2) / 2;
  const s = Number.isInteger(r) ? Math.abs(r).toLocaleString('en-US') : Math.abs(r).toFixed(2);
  return (r < 0 ? '−' : '') + '$' + s;
}

export function sign(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
}

export function fmtTc(tc: number): string {
  const r = Math.round(tc * 10) / 10;
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1);
}
