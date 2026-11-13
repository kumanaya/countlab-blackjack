'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react';
import { actions, getGame, useUI } from '@/lib/store';
import { MOVE_LABEL, money, sign } from '@/lib/game';
import { Icon } from './Icon';

function AnimatedMoney({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 120, damping: 22 });
  const text = useTransform(spring, (v) => money(v));
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);
  return <motion.span>{text}</motion.span>;
}

export function TopBar() {
  useUI((s) => s.v);
  const muted = useUI((s) => s.muted);
  const g = getGame();

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="diamond" size={18} />
        </span>
        <span className="brand-txt">
          <b>Count Lab</b>
          <small>hand {g.stats.hands}</small>
        </span>
      </div>

      <div className="topbar-right">
        <div className="bankroll" aria-label="Bankroll">
          <span className="k">Bankroll</span>
          <strong className="num">
            <AnimatedMoney value={g.bankroll} />
          </strong>
        </div>

        <div className="mode-switch" role="group" aria-label="Game mode">
          {(['classic', 'count'] as const).map((m) => (
            <button key={m} className={g.mode === m ? 'on' : ''} aria-pressed={g.mode === m} onClick={() => actions.setMode(m)}>
              {g.mode === m && <motion.i layoutId="mode-pill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span>{m === 'classic' ? 'Classic' : 'Count'}</span>
            </button>
          ))}
        </div>

        <button className="icon-btn" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted} onClick={actions.toggleSound}>
          <Icon name={muted ? 'mute' : 'sound'} />
        </button>
        <button className="icon-btn" aria-label="Learn and settings" onClick={() => actions.openGuide(true)}>
          <Icon name="book" />
        </button>
      </div>
    </header>
  );
}

export function CountRail() {
  useUI((s) => s.v);
  const quizOpen = useUI((s) => s.quizOpen);
  const g = getGame();
  // the count must stay hidden during the quiz
  if (g.mode !== 'count' || (quizOpen && !g.quiz?.done)) return null;
  const rc = g.running;
  const tc = g.trueCount();
  const decks = g.decksLeft();
  const heat = tc >= 2 ? 'hot' : tc <= -2 ? 'cold' : '';
  const fill = Math.max(0, Math.min(1, (tc + 5) / 10));
  const shoeFill = Math.min(1, g.shoe.length / (g.decks * 52));
  const cut = 1 - g.penetration;

  return (
    <motion.aside
      className={`count-rail ${heat} ${g.showCount ? '' : 'masked'}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      aria-live="polite"
    >
      <div className="rail-head">
        <span>Hi-Lo</span>
        <button className="eye" onClick={() => actions.toggleSetting('showCount')} aria-label={g.showCount ? 'Hide count' : 'Show count'}>
          <Icon name={g.showCount ? 'eye' : 'eyeOff'} size={15} />
        </button>
      </div>

      <div className="rail-block">
        <span className="k">Running</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.b
            key={g.showCount ? rc : 'x'}
            className="v big num"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {g.showCount ? sign(rc) : '?'}
          </motion.b>
        </AnimatePresence>
      </div>

      <div className="rail-block">
        <span className="k">True</span>
        <b className="v num">{g.showCount ? `${tc >= 0 ? '+' : '−'}${Math.abs(tc).toFixed(1)}` : '?'}</b>
        <div className="meter" aria-hidden="true">
          <i className="mid" />
          <motion.span className="fill" animate={{ scaleX: g.showCount ? fill : 0.5 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} />
        </div>
        <span className="heat-label">{g.showCount ? (heat === 'hot' ? 'hot table' : heat === 'cold' ? 'cold table' : 'neutral') : 'count in your head'}</span>
      </div>

      <div className="rail-block">
        <span className="k">Shoe</span>
        <b className="v num">{decks.toFixed(1)}</b>
        <div className="shoe-bar" aria-hidden="true">
          <motion.span animate={{ scaleY: shoeFill }} transition={{ duration: 0.4 }} />
          <i style={{ bottom: `${cut * 100}%` }} />
        </div>
      </div>
    </motion.aside>
  );
}

export function Banner() {
  useUI((s) => s.v);
  const coach = useUI((s) => s.coach);
  const g = getGame();
  const [showCoach, setShowCoach] = useState(false);

  useEffect(() => {
    if (!coach) return;
    setShowCoach(true);
    const t = setTimeout(() => setShowCoach(false), 2800);
    return () => clearTimeout(t);
  }, [coach]);

  return (
    <div className="banner-wrap">
      <AnimatePresence mode="wait">
        <motion.div
          key={g.banner}
          className={`banner ${g.bannerTone}`}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          {g.banner}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {showCoach && coach && g.phase === 'player' && (
          <motion.div className="coach" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Icon name="spark" size={13} />{' '}
            {coach.note ? (
              <>
                Count play: <b>{MOVE_LABEL[coach.move]}</b> <span className="coach-note">{coach.note}</span>
              </>
            ) : (
              <>Basic strategy: {MOVE_LABEL[coach.move]}</>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  const [visible, setVisible] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setVisible(toast);
    const t = setTimeout(() => setVisible(null), 2300);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.div key={visible.id} className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {visible.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
