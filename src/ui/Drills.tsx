'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { actions, getGame, getSfx, useUI } from '@/lib/store';
import { RANKS, SUITS, fmtTc, hiLo, parseCount, sign } from '@/lib/game';
import { Icon } from './Icon';

type DeckCard = { rank: string; suit: string };
const RED = new Set(['♥', '♦']);

function shuffledDeck(): DeckCard[] {
  const d: DeckCard[] = [];
  for (const suit of SUITS) for (const rank of RANKS) d.push({ rank, suit });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function MiniCard({ card }: { card: DeckCard }) {
  return (
    <div className={`mini-card ${RED.has(card.suit) ? 'red' : ''}`}>
      <span className="r">{card.rank}</span>
      <span className="s">{card.suit}</span>
      <span className="r flip">{card.rank}</span>
    </div>
  );
}

function AnswerForm({ onSubmit, label }: { onSubmit: (n: number) => void; label: string }) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);
  const step = (d: number) => setValue(String((parseInt(value || '0', 10) || 0) + d));
  return (
    <form
      className="drill-input"
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseCount(value);
        if (n === null) return;
        onSubmit(n);
      }}
    >
      <button type="button" className="step" onClick={() => step(-1)} aria-label="Minus one">
        −
      </button>
      <input ref={input} value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="0" aria-label={label} />
      <button type="button" className="step" onClick={() => step(1)} aria-label="Plus one">
        +
      </button>
      <button type="submit" className="act primary">
        <span className="act-txt">
          <b>Check</b>
        </span>
      </button>
    </form>
  );
}

/* ---------------- deck countdown ---------------- */

function Countdown() {
  // one card is removed: the final count tells you which group it came from
  const [deck, setDeck] = useState(() => shuffledDeck().slice(1));
  const [i, setI] = useState(-1);
  const [t0, setT0] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; answer: number; guess: number; secs: number } | null>(null);
  const finished = i >= deck.length;

  const flip = useCallback(() => {
    if (finished) return;
    if (i < 0) setT0(performance.now());
    setI((x) => x + 1);
    getSfx().deal();
  }, [finished, i]);

  useEffect(() => {
    if (i === deck.length) setElapsed((performance.now() - t0) / 1000);
  }, [i, deck.length, t0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        if (document.activeElement instanceof HTMLInputElement) return;
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flip]);

  const restart = () => {
    setDeck(shuffledDeck().slice(1));
    setI(-1);
    setResult(null);
  };

  const submit = (guess: number) => {
    const answer = deck.reduce((a, c) => a + hiLo(c), 0);
    const ok = guess === answer;
    setResult({ ok, answer, guess, secs: elapsed });
    getGame().recordCountdown(elapsed, ok);
    if (ok) getSfx().correct();
    else getSfx().wrong();
  };

  const best = getGame().stats.countdownBest;

  return (
    <>
      <div className="kicker">Deck countdown</div>
      <h2>{finished ? "What's the running count?" : 'Count the deck down'}</h2>
      {!finished && (
        <>
          <p className="drill-sub">51 cards: one is missing. Tap the card or press Space to flip. Keep the count in your head.</p>
          <button className="countdown-stage" onClick={flip} aria-label="Flip next card">
            {i < 0 ? (
              <div className="mini-card back">
                <span>Start</span>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div key={i} initial={{ x: 40, opacity: 0, rotate: 6 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ x: -40, opacity: 0, rotate: -6 }} transition={{ duration: 0.12 }}>
                  <MiniCard card={deck[i]} />
                </motion.div>
              </AnimatePresence>
            )}
          </button>
          <div className="drill-meta num">
            {Math.max(0, i + 1)}/{deck.length} {best !== null && <>· best {best.toFixed(1)}s</>}
          </div>
        </>
      )}
      {finished && !result && <AnswerForm onSubmit={submit} label="Final running count" />}
      {result && (
        <motion.div className="drill-fb" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`verdict ${result.ok ? 'ok' : 'no'}`}>
            {result.ok ? `Correct: ${sign(result.answer)} in ${result.secs.toFixed(1)}s.` : `It was ${sign(result.answer)}. You answered ${sign(result.guess)}.`}
          </div>
          <p className="drill-sub">
            A full deck counts to zero, so the missing card was {result.answer > 0 ? 'a ten or ace (−1)' : result.answer < 0 ? 'a 2–6 (+1)' : 'a 7, 8 or 9 (0)'}. Pros get under 25 seconds.
          </p>
          <div className="drill-btns">
            <button className="act primary" onClick={restart}>
              <span className="act-txt">
                <b>Again</b>
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

/* ---------------- true count conversion ---------------- */

function makeTcQuestion() {
  const decks = (1 + Math.floor(Math.random() * 10)) / 2; // 0.5 … 5.0
  const tc = Math.round((Math.random() * 2 - 0.6) * 6);
  const rc = Math.round(tc * decks + (Math.random() - 0.5) * decks);
  return { rc, decks };
}

function TrueCountDrill() {
  const [q, setQ] = useState(makeTcQuestion);
  const [result, setResult] = useState<{ ok: boolean; guess: number } | null>(null);
  const [streak, setStreak] = useState(0);
  const exact = q.rc / q.decks;
  const accepted = new Set([Math.floor(exact), Math.round(exact), Math.trunc(exact)]);

  const submit = (guess: number) => {
    const ok = accepted.has(guess);
    setResult({ ok, guess });
    setStreak((s) => (ok ? s + 1 : 0));
    getGame().recordTcDrill(ok);
    if (ok) getSfx().correct();
    else getSfx().wrong();
  };

  const next = () => {
    setQ(makeTcQuestion());
    setResult(null);
  };

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result]);

  const maxDecks = 6;
  return (
    <>
      <div className="kicker">True count</div>
      <h2>
        Running count <span className="num">{sign(q.rc)}</span>
      </h2>
      <div className="tc-visual" aria-label={`${q.decks} decks left in the shoe`}>
        <div className="tc-shoe">
          {Array.from({ length: maxDecks * 2 }, (_, k) => (
            <i key={k} className={k < q.decks * 2 ? 'on' : ''} />
          ))}
        </div>
        <span className="num">{q.decks} decks left</span>
      </div>
      {!result ? (
        <AnswerForm key={`${q.rc}/${q.decks}`} onSubmit={submit} label="True count" />
      ) : (
        <motion.div className="drill-fb" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`verdict ${result.ok ? 'ok' : 'no'}`}>
            {sign(q.rc)} ÷ {q.decks} = {fmtTc(exact)}
            {result.ok ? ' · correct' : ` · you answered ${sign(result.guess)}`}
          </div>
          <p className="drill-sub">Flooring or rounding both count. Streak: {streak}</p>
          <div className="drill-btns">
            <button className="act primary" onClick={next} autoFocus>
              <span className="act-txt">
                <b>Next</b>
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

export function Drills() {
  const open = useUI((s) => s.drillOpen);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="drill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="drill-card" initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            <button className="icon-btn drill-close" aria-label="Close drill" onClick={() => actions.openDrill(null)}>
              <Icon name="close" />
            </button>
            {open === 'countdown' ? <Countdown /> : <TrueCountDrill />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
