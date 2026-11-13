import { Game, handValue, bestMove, countMove, isBlackjack, suggestedUnits } from '../src/lib/game.ts';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k) : null),
  setItem: (k: string, v: string) => store.set(k, String(v)),
};

const results = { rounds: 0, splits: 0, doubles: 0, blackjacks: 0, insurance: 0, surrenders: 0, errors: [] as string[], maxHands: 1 };
const g = new Game({ hooks: {} });

async function playRound(forceSplit: boolean) {
  if (g.phase === 'quiz') g.closeQuiz();
  if (g.phase === 'settle') g.nextHand();
  if (g.phase !== 'bet') throw new Error('unexpected phase before hand: ' + g.phase);

  const startBank = g.bankroll;
  await g.startHand();
  results.rounds++;

  if ((g.phase as string) === 'insurance') {
    results.insurance++;
    await g.insurance(Math.random() < 0.5);
  }

  let guard = 0;
  while ((g.phase as string) === 'player' && guard++ < 30) {
    if (g.canSurrender() && Math.random() < 0.08) {
      await g.surrender();
      results.surrenders++;
      continue;
    }
    if (g.canSplit() && (forceSplit || Math.random() < 0.5)) {
      const before = g.hands.length;
      await g.split();
      if (g.hands.length > before) results.splits++;
      results.maxHands = Math.max(results.maxHands, g.hands.length);
      continue;
    }
    if (g.canDouble() && Math.random() < 0.3) {
      await g.double();
      results.doubles++;
      continue;
    }
    const h = g.currentHand()!;
    const v = handValue(h.cards);
    if (v.total >= 17 || Math.random() < 0.55) await g.stand();
    else await g.hit();
  }

  if ((g.phase as string) !== 'settle') throw new Error('hand did not settle: phase ' + g.phase);

  for (const h of g.hands) {
    if (!h.result) throw new Error('hand has no result');
    const v = handValue(h.cards);
    if (v.total > 21 && h.resultTone !== 'loss') throw new Error('bust without loss');
    if (isBlackjack(h.cards) && h.cards.length === 2 && h.resultTone === 'win') results.blackjacks++;
  }

  for (const s of g.seats) {
    if (!s.result) throw new Error(`seat ${s.name} has no result`);
    if (handValue(s.cards).total > 21 && s.resultTone !== 'loss') throw new Error('seat bust without loss');
  }

  const delta = g.bankroll - startBank;
  if (!Number.isFinite(delta)) throw new Error('invalid bankroll');
  const last = g.history[g.history.length - 1];
  const reloaded = g.banner.startsWith('Bankroll empty');
  if (!reloaded && Math.abs(last.net - delta) > 1e-9) throw new Error(`bankroll delta ${delta} != net ${last.net}`);
  return delta;
}

const configs = [
  { decks: 6, h17: false, das: true, surrender: true, seats: 2 },
  { decks: 2, h17: true, das: false, surrender: false, seats: 1 },
  { decks: 1, h17: true, das: true, surrender: true, seats: 0 },
];
try {
  for (const c of configs) {
    if (g.phase === 'quiz') g.closeQuiz();
    if (g.phase === 'settle') g.nextHand();
    if (!g.setRules(c)) throw new Error('setRules refused in bet phase');
    if (g.seats.length !== c.seats) throw new Error('seat count mismatch');
    for (let i = 0; i < 200; i++) await playRound(false);
    for (let i = 0; i < 80; i++) await playRound(true);
  }
} catch (err) {
  results.errors.push((err as Error).message);
}

const sanity = [];
const up = (r: string) => ({ rank: r, suit: '♠' });
const card = (r: string) => ({ rank: r, suit: '♠' });

sanity.push(['16 vs 6 = S', bestMove([card('10'), card('6')], up('6')) === 'S']);
sanity.push(['16 vs 7 = H', bestMove([card('10'), card('6')], up('7')) === 'H']);
sanity.push(['11 = D', bestMove([card('5'), card('6')], up('10')) === 'D']);
sanity.push(['8,8 = P', bestMove([card('8'), card('8')], up('10'), { canSplit: true }) === 'P']);
sanity.push(['A,7 vs 2 = S', bestMove([card('A'), card('7')], up('2')) === 'S']);
sanity.push(['A,7 vs 4 = D', bestMove([card('A'), card('7')], up('4')) === 'D']);
sanity.push(['A,9 = S', bestMove([card('A'), card('9')], up('6')) === 'S']);
sanity.push(['12 vs 3 = H', bestMove([card('10'), card('2')], up('3')) === 'H']);
sanity.push(['soft 21 = 21', handValue([card('A'), card('K')]).total === 21]);
sanity.push(['A,6 = 17 soft', handValue([card('A'), card('6')]).total === 17]);
const sur = { canSurrender: true };
const cm = (a: string, b: string, u: string, tc: number, o = {}) => countMove([card(a), card(b)], up(u), tc, o).move;
sanity.push(['16 vs 10 surrender', bestMove([card('10'), card('6')], up('10'), sur) === 'R']);
sanity.push(['16 vs 10 TC+1 no-sur = S', cm('10', '6', '10', 1) === 'S']);
sanity.push(['16 vs 10 TC-1 no-sur = H', cm('10', '6', '10', -1) === 'H']);
sanity.push(['15 vs 10 TC0 = R', cm('10', '5', '10', 0, sur) === 'R']);
sanity.push(['15 vs 10 TC-1 = H', cm('10', '5', '10', -1, sur) === 'H']);
sanity.push(['14 vs 10 TC+3 = R', cm('10', '4', '10', 3, sur) === 'R']);
sanity.push(['12 vs 3 TC+2 = S', cm('10', '2', '3', 2) === 'S']);
sanity.push(['12 vs 4 TC-1 = H', cm('10', '2', '4', -1) === 'H']);
sanity.push(['11 vs A TC+1 = D', cm('5', '6', 'A', 1) === 'D']);
sanity.push(['11 vs A TC0 = H (S17)', cm('5', '6', 'A', 0) === 'H']);
sanity.push(['10,10 vs 6 TC+4 = P', cm('10', 'K', '6', 4, { canSplit: true }) === 'P']);
sanity.push(['10,10 vs 6 TC+3 = S', cm('10', 'K', '6', 3, { canSplit: true }) === 'S']);
sanity.push(['8,8 vs 10 stays P', cm('8', '8', '10', 5, { canSplit: true, canSurrender: true }) === 'P']);
sanity.push(['ramp TC+1 = 1u', suggestedUnits(1.4) === 1]);
sanity.push(['ramp TC+3 = 4u', suggestedUnits(3.2) === 4]);
sanity.push(['ramp TC+9 = 8u', suggestedUnits(9) === 8]);
sanity.push(['A,7 vs 2 H17 = D', bestMove([card('A'), card('7')], up('2'), { rules: { h17: true } }) === 'D']);
sanity.push(['6,6 vs 2 no DAS = H', bestMove([card('6'), card('6')], up('2'), { canSplit: true, rules: { das: false } }) === 'H']);

console.log(
  JSON.stringify(
    {
      ...results,
      finalBankroll: g.bankroll,
      trueCount: Number(g.trueCount().toFixed(2)),
      running: g.running,
      sanityFailed: sanity.filter(([, ok]) => !ok).map(([n]) => n),
      sanityPassed: sanity.filter(([, ok]) => ok).length,
    },
    null,
    2
  )
);
if (results.errors.length || sanity.some(([, ok]) => !ok)) process.exit(1);
