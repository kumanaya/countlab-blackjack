'use client';
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { actions, getGame, useUI } from '@/lib/store';
import { FAB4, ILLUSTRIOUS18, INSURANCE_INDEX, bestMove, money, playLabel, type Move, type Quality, type Rules } from '@/lib/game';
import { HistoryChart } from './HistoryChart';
import { Icon } from './Icon';

const CELL: Record<Move, string> = { H: 'H', S: 'S', D: 'D', P: 'P', R: 'R' };

function StrategyTable({ rules }: { rules: Rules }) {
  const rows = useMemo(() => {
    const r = (v: number) => ({ rank: v === 11 ? 'A' : String(v) });
    const hard: [string, number[]][] = [
      ['17+', [10, 7]], ['16', [10, 6]], ['15', [10, 5]], ['14', [10, 4]], ['13', [10, 3]],
      ['12', [10, 2]], ['11', [5, 6]], ['10', [4, 6]], ['9', [4, 5]], ['5–8', [3, 4]],
    ];
    const soft: [string, number[]][] = [9, 8, 7, 6, 5, 4, 3, 2].map((k) => [`A,${k}`, [11, k]]);
    const pairs: [string, number[]][] = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((k) => [
      k === 11 ? 'A,A' : `${k},${k}`,
      [k, k],
    ]);
    const cols = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const build = (list: [string, number[]][], split: boolean) =>
      list.map(([name, pair]) => ({
        name,
        cells: cols.map((d) => bestMove(pair.map(r), r(d), { canDouble: true, canSplit: split, canSurrender: true, rules })),
      }));
    return { cols, groups: [
      { title: 'Hard', rows: build(hard, false) },
      { title: 'Soft', rows: build(soft, false) },
      { title: 'Pairs', rows: build(pairs, true) },
    ] };
  }, [rules]);

  return (
    <div className="tbl-wrap">
      <table className="strategy">
        <thead>
          <tr>
            <th />
            {rows.cols.map((c) => (
              <th key={c}>{c === 11 ? 'A' : c}</th>
            ))}
          </tr>
        </thead>
        {rows.groups.map((grp) => (
          <tbody key={grp.title}>
            <tr className="grp">
              <td colSpan={11}>{grp.title}</td>
            </tr>
            {grp.rows.map((row) => (
              <tr key={row.name}>
                <td className="rowh">{row.name}</td>
                {row.cells.map((m, i) => (
                  <td key={i} className={`c-${m}`}>
                    {CELL[m]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

const SETTINGS = [
  ['showCount', 'Show count', 'Turn off to keep the count in your head.'],
  ['coach', 'Strategy coach', 'Warns when a play, bet or insurance call is off. Uses index plays in Count mode.'],
  ['drill', 'End-of-hand quiz', 'A quick count check after every hand.'],
] as const;

function Seg<T extends string | number>({
  label,
  sub,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  sub?: string;
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="setting">
      <div className="lbl">
        {label}
        {sub && <small>{sub}</small>}
      </div>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} disabled={disabled} onClick={() => onChange(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ label, sub, on, onClick, disabled }: { label: string; sub?: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="setting">
      <div className="lbl">
        {label}
        {sub && <small>{sub}</small>}
      </div>
      <button className={`sw ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}>
        <motion.i layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
      </button>
    </div>
  );
}

export function Guide() {
  useUI((s) => s.v);
  const open = useUI((s) => s.guideOpen);
  const g = getGame();
  const s = g.stats;
  const r = g.rules;
  const locked = g.phase !== 'bet';
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const row = (k: string, a: number, b: number) => [k, `${a}/${a + b}`, pct(a, a + b)];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => actions.openGuide(false)} />
          <motion.section
            className="sheet"
            role="dialog"
            aria-label="Learn"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
          >
            <div className="sheet-head">
              <h2>Learn</h2>
              <button className="icon-btn" aria-label="Close" onClick={() => actions.openGuide(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="sheet-body">
              <section>
                <h3>Performance</h3>
                <div className="stats">
                  {[
                    row('Count quiz', s.quizRight, s.quizWrong),
                    row('Basic strategy', s.stratRight, s.stratWrong),
                    row('Index plays', s.devRight, s.devWrong),
                    row('Bet ramp', s.betRight, s.betWrong),
                    row('Insurance', s.insRight, s.insWrong),
                    row('TC drill', s.tcRight, s.tcWrong),
                    ['Streak', String(s.run), `best ${s.bestRun}`],
                    ['Countdown', s.countdownBest === null ? '–' : `${s.countdownBest.toFixed(1)}s`, `${s.countdownRuns} runs`],
                    ['Hands', String(s.hands), money(g.bankroll)],
                  ].map(([k, v, d]) => (
                    <div className="stat" key={k}>
                      <span className="k">{k}</span>
                      <b className="num">{v}</b>
                      <span className="d">{d}</span>
                    </div>
                  ))}
                </div>
                <h4>Bankroll</h4>
                <HistoryChart data={g.history} />
                <div className="row-btns">
                  <button className="ghost-btn" onClick={actions.resetStats}>
                    <Icon name="reset" size={14} /> Clear stats
                  </button>
                  <button className="ghost-btn" onClick={actions.resetBankroll} disabled={locked}>
                    <Icon name="reset" size={14} /> Reset bankroll
                  </button>
                </div>
              </section>

              <section>
                <h3>Drills</h3>
                <div className="drill-picks">
                  <button className="drill-pick" onClick={() => actions.openDrill('countdown')}>
                    <Icon name="timer" size={20} />
                    <b>Deck countdown</b>
                    <small>Count down a full deck as fast as you can. It should end at zero.</small>
                  </button>
                  <button className="drill-pick" onClick={() => actions.openDrill('tc')}>
                    <Icon name="ramp" size={20} />
                    <b>True count</b>
                    <small>Convert a running count and the decks left into a true count.</small>
                  </button>
                </div>
              </section>

              <section>
                <h3>Training</h3>
                {SETTINGS.map(([key, title, sub]) => (
                  <Switch key={key} label={title} sub={sub} on={g[key]} onClick={() => actions.toggleSetting(key)} />
                ))}
              </section>

              <section>
                <h3>Table rules</h3>
                {locked && <p className="note">Rules can change between hands.</p>}
                <Seg label="Decks" value={r.decks} options={[1, 2, 6, 8].map((v) => ({ v, t: String(v) }))} onChange={(v) => actions.setRules({ decks: v })} disabled={locked} />
                <Seg
                  label="Penetration"
                  sub="How deep the shoe is dealt before the shuffle."
                  value={r.penetration}
                  options={[0.65, 0.75, 0.85].map((v) => ({ v, t: `${Math.round(v * 100)}%` }))}
                  onChange={(v) => actions.setRules({ penetration: v })}
                  disabled={locked}
                />
                <Seg label="AI players" sub="Their cards count too." value={r.seats} options={[0, 1, 2].map((v) => ({ v, t: String(v) }))} onChange={(v) => actions.setRules({ seats: v })} disabled={locked} />
                <Seg label="Betting unit" sub="Base bet for the ramp." value={r.unit} options={[5, 10, 25].map((v) => ({ v, t: money(v) }))} onChange={(v) => actions.setRules({ unit: v })} disabled={locked} />
                <Switch label="Dealer hits soft 17" sub="H17 costs you about 0.2%." on={r.h17} onClick={() => actions.setRules({ h17: !r.h17 })} disabled={locked} />
                <Switch label="Double after split" on={r.das} onClick={() => actions.setRules({ das: !r.das })} disabled={locked} />
                <Switch label="Late surrender" sub="Give up half your bet after the dealer peeks." on={r.surrender} onClick={() => actions.setRules({ surrender: !r.surrender })} disabled={locked} />
                <p>Blackjack pays 3:2, insurance 2:1. The dealer peeks for blackjack with an ace or ten up. Split up to 4 hands; split aces get one card each.</p>
              </section>

              <section>
                <h3>Device</h3>
                <Seg<Quality>
                  label="Graphics"
                  sub="Lower it on slow or hot devices."
                  value={g.quality}
                  options={[
                    { v: 'high', t: 'High' },
                    { v: 'medium', t: 'Medium' },
                    { v: 'low', t: 'Low' },
                  ]}
                  onChange={actions.setQuality}
                />
                <Switch label="Haptics" sub="Vibration on results, on supported phones." on={g.haptics} onClick={actions.toggleHaptics} />
              </section>

              <section>
                <h3>Hi-Lo</h3>
                <div className="kv"><b className="plus">+1</b><span>2 3 4 5 6</span></div>
                <div className="kv"><b>0</b><span>7 8 9</span></div>
                <div className="kv"><b className="minus">−1</b><span>10 J Q K A</span></div>
                <p>Only face-up cards count, including the other players&apos; cards. The dealer&apos;s hole card counts once it&apos;s revealed.</p>
              </section>

              <section>
                <h3>True count and bet ramp</h3>
                <p>
                  The running count divided by the decks remaining. Bet 1 unit below +2, then 2 units per true count above +1 (TC +2 → 2 units, +3 → 4, +4 → 6, +5 → 8). The room&apos;s backlight follows along: gold when hot, blue when cold.
                </p>
              </section>

              <section>
                <h3>Basic strategy</h3>
                <p className="note">
                  {r.decks} deck{r.decks > 1 ? 's' : ''}, {r.h17 ? 'H17' : 'S17'}, {r.das ? 'DAS' : 'no DAS'}
                  {r.surrender ? ', late surrender' : ''}
                </p>
                <StrategyTable rules={r} />
                <div className="legend">
                  <span><b className="c-H">H</b> hit</span>
                  <span><b className="c-S">S</b> stand</span>
                  <span><b className="c-D">D</b> double</span>
                  <span><b className="c-P">P</b> split</span>
                  {r.surrender && <span><b className="c-R">R</b> surrender</span>}
                </div>
              </section>

              <section>
                <h3>Index plays</h3>
                <h4>Insurance</h4>
                <ul>
                  <li>Take insurance at TC ≥ +{INSURANCE_INDEX}</li>
                </ul>
                <h4>Illustrious 18</h4>
                <ul className="index-list">
                  {ILLUSTRIOUS18.map((p) => (
                    <li key={p.id}>{playLabel(p)}</li>
                  ))}
                </ul>
                <h4>Fab 4 surrenders</h4>
                <ul className="index-list">
                  {FAB4.map((p) => (
                    <li key={p.id}>{playLabel(p)}</li>
                  ))}
                </ul>
                <p className="note">Hard totals only. In Count mode the coach applies these for you.</p>
              </section>

              <section>
                <h3>Shortcuts</h3>
                <div className="keys">
                  <span><kbd>H</kbd> hit</span>
                  <span><kbd>S</kbd> stand</span>
                  <span><kbd>D</kbd> double</span>
                  <span><kbd>P</kbd> split</span>
                  <span><kbd>R</kbd> surrender</span>
                  <span><kbd>I</kbd>/<kbd>N</kbd> insurance</span>
                  <span><kbd>Enter</kbd> deal / new hand</span>
                </div>
              </section>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
