'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { actions, getGame, hiLo, useUI } from '@/lib/store';
import { sign, type Quiz as QuizT } from '@/lib/game';

export function Quiz() {
  const open = useUI((s) => s.quizOpen);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<QuizT | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const g = getGame();

  useEffect(() => {
    if (!open) return;
    setValue('');
    setResult(null);
    const t = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open]);

  const check = () => {
    const q = actions.answerQuiz(value);
    if (q) setResult({ ...q });
  };
  const close = (next: boolean) => {
    actions.closeQuiz();
    if (next) actions.next();
  };

  const tc = g.trueCount();

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="drill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className={`drill-card ${result ? (result.ok ? 'ok' : 'no') : ''}`}
            initial={{ y: 30, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="kicker">Count check</div>
            <h2>What's the running count?</h2>

            {!result ? (
              <form
                className="drill-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  check();
                }}
              >
                <button type="button" className="step" onClick={() => setValue(String((parseInt(value || '0', 10) || 0) - 1))} aria-label="Minus one">
                  −
                </button>
                <input
                  ref={input}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  aria-label="Your answer"
                />
                <button type="button" className="step" onClick={() => setValue(String((parseInt(value || '0', 10) || 0) + 1))} aria-label="Plus one">
                  +
                </button>
                <button type="submit" className="act primary">
                  <span className="act-txt"><b>Check</b></span>
                </button>
              </form>
            ) : (
              <motion.div className="drill-fb" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className={`verdict ${result.ok ? 'ok' : 'no'}`}>
                  {result.ok ? `Correct. The count is ${sign(result.answer)}.` : `It was ${sign(result.answer)}. You answered ${sign(result.guess ?? 0)}.`}
                </div>
                {!result.ok && (
                  <>
                    <p>Cards dealt this hand:</p>
                    <div className="drill-break">
                      {g.roundCards.map((c) => {
                        const v = hiLo(c);
                        return (
                          <span key={c.id} className={v > 0 ? 'plus' : v < 0 ? 'minus' : ''}>
                            {c.rank}
                            {c.suit} <em>{v > 0 ? '+1' : v < 0 ? '−1' : '0'}</em>
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="drill-meta">
                  True count {tc >= 0 ? '+' : '−'}
                  {Math.abs(tc).toFixed(1)} · {g.decksLeft().toFixed(1)} decks left in the shoe · streak {g.stats.run}
                </div>
                <div className="drill-actions">
                  <button className="act" onClick={() => close(false)}>
                    <span className="act-txt"><b>View table</b></span>
                  </button>
                  <button className="act primary" onClick={() => close(true)} autoFocus>
                    <span className="act-txt"><b>Next hand</b></span>
                    <kbd>Enter</kbd>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
