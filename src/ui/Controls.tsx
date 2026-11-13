'use client';
import { AnimatePresence, motion } from 'motion/react';
import { actions, getGame, useUI } from '@/lib/store';
import { fmtTc, handValue, money } from '@/lib/game';
import { Icon } from './Icon';

const CHIPS = [
  { v: 5, cls: 'red' },
  { v: 25, cls: 'green' },
  { v: 100, cls: 'black' },
  { v: 500, cls: 'purple' },
];

function ChipButton({ v, cls, disabled }: { v: number; cls: string; disabled: boolean }) {
  return (
    <motion.button
      className={`chip ${cls}`}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -4 }}
      whileTap={disabled ? undefined : { scale: 0.92, y: 0 }}
      onClick={() => actions.addBet(v)}
      aria-label={`Add ${v} to bet`}
    >
      <span className="chip-face">{v}</span>
    </motion.button>
  );
}

function ActionButton({
  label,
  sub,
  kbd,
  icon,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  sub?: string;
  kbd?: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <motion.button
      layout
      className={`act ${primary ? 'primary' : ''}`}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <span className="act-icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="act-txt">
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </span>
      {kbd && <kbd>{kbd}</kbd>}
    </motion.button>
  );
}

export function Controls() {
  useUI((s) => s.v);
  const g = getGame();

  let body: React.ReactNode;

  if (g.phase === 'bet') {
    body = (
      <motion.div key="bet" className="bet-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
        <div className="bet-row">
          <div className="chip-tray">
            {CHIPS.map((c) => (
              <ChipButton key={c.v} {...c} disabled={g.bet + c.v > g.bankroll} />
            ))}
            <button className="chip-reset" onClick={actions.minBet} aria-label="Reset to minimum bet">
              <Icon name="reset" size={16} />
            </button>
          </div>
          <div className="bet-amount">
            <span className="k">Bet</span>
            <b className="num">{money(g.bet)}</b>
          </div>
        </div>
        {g.mode === 'count' && (
          <button
            className={`ramp-btn ${g.bet === g.suggestedBet() ? 'on' : ''}`}
            onClick={actions.useSuggestedBet}
            title="Bet ramp: 1 unit below TC +2, then 2 units per true count"
          >
            <Icon name="ramp" size={15} />
            <span>
              Ramp <b className="num">{money(g.suggestedBet())}</b>
            </span>
            <small className="num">TC {fmtTc(g.trueCount())}</small>
          </button>
        )}
        <motion.button className="deal-btn" whileTap={{ scale: 0.98 }} disabled={g.bet > g.bankroll || g.busy} onClick={actions.deal}>
          <span>Deal</span>
          <kbd>Enter</kbd>
        </motion.button>
      </motion.div>
    );
  } else if (g.phase === 'player') {
    const h = g.currentHand();
    const v = h ? handValue(h.cards).total : 0;
    const can = g.canAct();
    body = (
      <motion.div key="play" className="act-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <AnimatePresence mode="popLayout">
          <ActionButton key="hit" label="Hit" sub="take a card" kbd="H" icon="plus" onClick={actions.hit} disabled={!can} />
          {v <= 21 && <ActionButton key="stand" label="Stand" sub="hold" kbd="S" icon="stop" onClick={actions.stand} disabled={!can} primary />}
          <ActionButton key="double" label="Double" sub={h ? money(h.bet) : ''} kbd="D" icon="double" onClick={actions.double} disabled={!g.canDouble()} />
          {g.canSplit() && <ActionButton key="split" label="Split" sub="pair" kbd="P" icon="split" onClick={actions.split} />}
          {g.canSurrender() && <ActionButton key="surrender" label="Surrender" sub="lose half" kbd="R" icon="flag" onClick={actions.surrender} />}
        </AnimatePresence>
      </motion.div>
    );
  } else if (g.phase === 'insurance') {
    const cost = g.insuranceCost();
    body = (
      <motion.div key="ins" className="act-row" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <ActionButton
          label="Insurance"
          sub={`pay ${money(cost)}`}
          kbd="I"
          icon="shield"
          onClick={() => actions.insurance(true)}
          disabled={g.bankroll < cost || g.busy}
        />
        <ActionButton label="No insurance" sub="play on" kbd="N" icon="next" onClick={() => actions.insurance(false)} disabled={g.busy} primary />
      </motion.div>
    );
  } else {
    const waiting = g.phase === 'dealer';
    const quiz = g.phase === 'quiz';
    body = (
      <motion.div key="next" className="act-row single" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        {quiz ? (
          <ActionButton label="Answer" sub="count check" icon="spark" onClick={() => useUI.setState({ quizOpen: true })} primary />
        ) : (
          <ActionButton
            label={waiting ? 'Dealer plays…' : 'New hand'}
            sub={waiting ? 'please wait' : 'continue'}
            kbd={waiting ? undefined : 'Enter'}
            icon="next"
            onClick={actions.next}
            disabled={waiting}
            primary
          />
        )}
      </motion.div>
    );
  }

  return (
    <footer className="controls">
      <AnimatePresence mode="wait">{body}</AnimatePresence>
    </footer>
  );
}
