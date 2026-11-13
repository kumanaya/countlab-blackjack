/* Presentation state (React) + bridge to the single game instance.
 * Game stays the source of truth; `v` changes on every hook so
 * components re-read its fields. */
import { create } from 'zustand';
import { Game, hiLo, type Card, type Move, type Quality, type Rules, type Tone } from './game';
import { Sfx } from './sound';
import { makeLayout, type Layout } from '@/three/layout';

export interface Pop {
  id: number;
  cardId: number;
  value: number;
}

interface UIState {
  v: number;
  layout: Layout;
  toast: { id: number; text: string } | null;
  coach: { id: number; move: Move; note?: string } | null;
  pops: Pop[];
  flash: { id: number; tone: Tone; blackjack: boolean } | null;
  quizOpen: boolean;
  guideOpen: boolean;
  drillOpen: 'countdown' | 'tc' | null;
  shuffleId: number;
  muted: boolean;
}

export const useUI = create<UIState>(() => ({
  v: 0,
  layout: makeLayout(16 / 9),
  toast: null,
  coach: null,
  pops: [],
  flash: null,
  quizOpen: false,
  guideOpen: false,
  drillOpen: null,
  shuffleId: 0,
  muted: false,
}));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let uid = 1;

export function bump() {
  useUI.setState((s) => ({ v: s.v + 1 }));
}

export function toast(text: string) {
  useUI.setState({ toast: { id: uid++, text } });
}

let pending: { card: Card; value: number } | null = null;

function flushPop(card: Card) {
  if (!pending || pending.card !== card) return;
  const pop = { id: uid++, cardId: card.id, value: pending.value };
  pending = null;
  useUI.setState((s) => ({ pops: [...s.pops.slice(-12), pop] }));
}

/** Short vibration on supported phones, when haptics are on. */
export function buzz(pattern: number | number[]) {
  if (!game?.haptics) return;
  try {
    globalThis.navigator?.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

let game: Game | null = null;
let sfx: Sfx | null = null;

export function getSfx() {
  if (!sfx) {
    sfx = new Sfx();
    useUI.setState({ muted: sfx.muted });
  }
  return sfx;
}

export function getGame(): Game {
  if (game) return game;
  const s = getSfx();
  game = new Game({
    hooks: {
      onHud: bump,
      onPhase: bump,
      onToast: toast,
      onCoach: ({ move, note }) => {
        if (game?.coach) useUI.setState({ coach: { id: uid++, move, note } });
      },
      onCount: (card, value) => {
        if (game?.mode === 'count') pending = { card, value };
      },
      onDeal: async (card, meta) => {
        s.deal();
        bump();
        if (card.faceUp) setTimeout(() => s.flip(), 230);
        await sleep(meta.to === 'dealer' ? 430 : meta.to === 'seat' ? 330 : 400);
        flushPop(card);
      },
      onReveal: async (card) => {
        s.flip();
        bump();
        await sleep(520);
        flushPop(card);
      },
      onSplit: async () => {
        s.chip();
        bump();
        await sleep(380);
      },
      onSeatTurn: async () => {
        bump();
        await sleep(320);
      },
      onRoundStart: async () => {
        s.chip();
        bump();
        await sleep(160);
      },
      onSettle: async ({ tone, hands }) => {
        const blackjack = hands.some((h) => h.result === 'blackjack');
        if (blackjack) s.blackjack();
        else if (tone === 'win') s.win();
        else if (tone === 'loss') s.loss();
        else s.push();
        buzz(blackjack ? [30, 60, 30, 60, 60] : tone === 'win' ? [25, 50, 25] : tone === 'loss' ? 80 : 15);
        useUI.setState({ flash: { id: uid++, tone, blackjack } });
        bump();
      },
      onShuffle: async () => {
        s.shuffle();
        toast('Reshuffling the shoe…');
        useUI.setState((st) => ({ shuffleId: st.shuffleId + 1 }));
        await sleep(900);
      },
      onQuiz: () => {
        s.click();
        useUI.setState({ quizOpen: true });
      },
    },
  });
  if (typeof window !== 'undefined') (window as unknown as { __countlab: unknown }).__countlab = { game };
  return game;
}

/* ---------------- intents coming from the UI ---------------- */

function run(fn: () => unknown) {
  Promise.resolve(fn()).catch((err) => {
    console.error(err);
    toast('Something went wrong with that move');
  });
}

export const actions = {
  addBet(amount: number) {
    const g = getGame();
    if (g.phase !== 'bet') return;
    g.setBet(amount);
    getSfx().chip();
  },
  minBet() {
    const g = getGame();
    g.minBet();
    getSfx().chip();
  },
  deal() {
    run(() => getGame().startHand());
  },
  hit() {
    run(() => getGame().hit());
  },
  stand() {
    run(() => getGame().stand());
  },
  double() {
    run(() => getGame().double());
  },
  split() {
    run(() => getGame().split());
  },
  surrender() {
    run(() => getGame().surrender());
  },
  insurance(take: boolean) {
    getSfx().chip();
    run(() => getGame().insurance(take));
  },
  useSuggestedBet() {
    const g = getGame();
    if (g.phase !== 'bet') return;
    g.setBetExact(g.suggestedBet());
    getSfx().chip();
  },
  setRules(patch: Partial<Rules>) {
    const g = getGame();
    if (!g.setRules(patch)) {
      toast('Rules change between hands');
      return;
    }
    getSfx().click();
  },
  setQuality(q: Quality) {
    const g = getGame();
    g.quality = q;
    g.save();
    getSfx().click();
    bump();
  },
  toggleHaptics() {
    const g = getGame();
    g.haptics = !g.haptics;
    g.save();
    getSfx().click();
    buzz(20);
    bump();
  },
  resetStats() {
    getGame().resetStats();
    toast('Stats and history cleared');
  },
  resetBankroll() {
    const g = getGame();
    if (g.phase !== 'bet') {
      toast('Finish the hand first');
      return;
    }
    g.resetBankroll();
    toast('Bankroll reset');
  },
  openDrill(kind: 'countdown' | 'tc' | null) {
    getSfx().click();
    useUI.setState({ drillOpen: kind, guideOpen: false });
  },
  next() {
    const g = getGame();
    if (g.phase === 'quiz') return;
    g.nextHand();
    useUI.setState({ pops: [], flash: null });
  },
  setMode(mode: 'classic' | 'count') {
    const g = getGame();
    if (mode === g.mode) return;
    if (g.phase !== 'bet' && g.phase !== 'settle') {
      toast('Finish the hand to switch modes');
      return;
    }
    g.mode = mode;
    g.save();
    getSfx().click();
    toast(mode === 'classic' ? 'Classic mode: no count, no quiz' : 'Count mode: Hi-Lo and drills on');
    bump();
  },
  toggleSetting(key: 'showCount' | 'coach' | 'drill') {
    const g = getGame();
    g[key] = !g[key];
    g.save();
    getSfx().click();
    if (key === 'showCount') toast(g.showCount ? 'Count visible' : 'Count hidden: keep it in your head');
    bump();
  },
  toggleSound() {
    const s = getSfx();
    s.ensure();
    const muted = s.toggle();
    useUI.setState({ muted });
    if (!muted) s.click();
    toast(muted ? 'Sound off' : 'Sound on');
  },
  openGuide(open: boolean) {
    getSfx().click();
    useUI.setState({ guideOpen: open });
  },
  answerQuiz(raw: string) {
    const q = getGame().answerQuiz(raw);
    if (!q) {
      toast('Enter a number');
      return null;
    }
    if (q.ok) getSfx().correct();
    else {
      getSfx().wrong();
      buzz(60);
    }
    return q;
  },
  closeQuiz() {
    getGame().closeQuiz();
    useUI.setState({ quizOpen: false });
  },
};

export { hiLo };
