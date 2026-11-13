'use client';
import { useMemo, useRef, useState } from 'react';
import { fmtTc, money, type HistoryPoint } from '@/lib/game';

const W = 320;
const H = 140;
const PAD = { l: 44, r: 10, t: 10, b: 20 };

/** Bankroll after each hand: single series, crosshair + tooltip on hover. */
export function HistoryChart({ data }: { data: HistoryPoint[] }) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const ys = data.map((d) => d.bankroll);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    if (hi - lo < 50) {
      lo -= 25;
      hi += 25;
    }
    const span = hi - lo;
    lo -= span * 0.08;
    hi += span * 0.08;
    const x = (i: number) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.bankroll).toFixed(1)}`).join('');
    const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].map((v) => Math.round(v / 10) * 10);
    return { x, y, path, ticks };
  }, [data]);

  if (!geo) return <p className="chart-empty">Play a few hands to see your bankroll over time.</p>;

  const onMove = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const first = data[0];
  const last = data[data.length - 1];
  const d = hover !== null ? data[hover] : null;

  return (
    <figure className="chart">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Bankroll over the last ${data.length} hands, from ${money(first.bankroll)} to ${money(last.bankroll)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} className="grid" />
            <text x={PAD.l - 6} y={geo.y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {money(t)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 4} className="tick">
          hand {first.n}
        </text>
        <text x={W - PAD.r} y={H - 4} className="tick" textAnchor="end">
          hand {last.n}
        </text>
        <path d={geo.path} className="line" />
        <circle cx={geo.x(data.length - 1)} cy={geo.y(last.bankroll)} r={4} className="dot" />
        {d && hover !== null && (
          <g>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={H - PAD.b} className="cross" />
            <circle cx={geo.x(hover)} cy={geo.y(d.bankroll)} r={4.5} className="dot" />
          </g>
        )}
      </svg>
      <figcaption className="chart-tip" aria-live="polite">
        {d ? (
          <>
            Hand {d.n}: <b className="num">{money(d.bankroll)}</b>{' '}
            <span className={d.net > 0 ? 'up' : d.net < 0 ? 'down' : ''}>
              ({d.net > 0 ? '+' : d.net < 0 ? '−' : '±'}
              {money(Math.abs(d.net))})
            </span>{' '}
            · bet {money(d.bet)} · TC {fmtTc(d.tc)}
          </>
        ) : (
          <>
            Last {data.length} hands · now <b className="num">{money(last.bankroll)}</b>
          </>
        )}
      </figcaption>
    </figure>
  );
}
