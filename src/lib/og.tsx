/* Social preview image (Open Graph / Twitter), rendered by next/og at build time. */
import { ImageResponse } from 'next/og';
import { SITE } from './site';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = `${SITE.title}: ${SITE.tagline}`;

/** Loads a Google font as TTF for Satori; falls back to the default font when offline. */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

const INK = '#f3ead7';
const GOLD = '#d8b46a';
const GOLD2 = '#f0d48a';

function Card({ rank, suit, red, x, y, rot, back }: { rank?: string; suit?: string; red?: boolean; x: number; y: number; rot: number; back?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 178,
        height: 250,
        borderRadius: 16,
        transform: `rotate(${rot}deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: back ? '#6d1a28' : '#f6f1e5',
        border: back ? '8px solid #f6f1e5' : '1px solid #d9cfb8',
        boxShadow: '0 24px 50px rgba(0,0,0,0.55)',
        color: red ? '#b3122b' : '#14171c',
        fontFamily: 'Cinzel',
      }}
    >
      {back ? (
        <div style={{ width: 92, height: 92, border: `4px solid ${GOLD}`, transform: 'rotate(45deg)', display: 'flex' }} />
      ) : (
        <>
          <div style={{ position: 'absolute', top: 12, left: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 38, lineHeight: 1.05 }}>
            <span>{rank}</span>
            <span style={{ fontSize: 28 }}>{suit}</span>
          </div>
          <span style={{ fontSize: 80, marginTop: 24 }}>{suit}</span>
        </>
      )}
    </div>
  );
}

function Chip({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 96,
        height: 96,
        borderRadius: 48,
        background: color,
        border: '8px dashed #f3ead7',
        boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
        display: 'flex',
      }}
    />
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'plus' }) {
  const c = tone === 'plus' ? '#5fe39a' : GOLD2;
  return (
    <div
      style={{
        display: 'flex',
        padding: '8px 18px',
        borderRadius: 999,
        border: `2px solid ${c}55`,
        background: 'rgba(12,11,10,0.6)',
        color: c,
        fontSize: 24,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

type Font = { name: string; data: ArrayBuffer; weight: 600 | 700; style: 'normal' };

export async function renderOg() {
  const title = 'COUNT LAB';
  const body = 'BLACKJACK 3D Hi-Lo basic strategy index plays bet ramp RC +7 True count +2.4 3D blackjack trainer for card counting';
  const [cinzel, manrope] = await Promise.all([googleFont('Cinzel', 700, title + 'AK♠♥'), googleFont('Manrope', 700, body)]);
  const fonts: Font[] = [];
  if (cinzel) fonts.push({ name: 'Cinzel', data: cinzel, weight: 700, style: 'normal' });
  if (manrope) fonts.push({ name: 'Manrope', data: manrope, weight: 700, style: 'normal' });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 70% 0%, #2a1a10 0%, #0b0907 55%, #050607 100%)',
          fontFamily: 'Manrope',
          color: INK,
        }}
      >
        {/* table: wood apron, leather rail and felt */}
        <div style={{ position: 'absolute', left: 330, top: 300, width: 1300, height: 760, borderRadius: '50%', background: '#2a120a', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 350, top: 318, width: 1260, height: 724, borderRadius: '50%', background: '#3a110f', display: 'flex' }} />
        <div
          style={{
            position: 'absolute',
            left: 376,
            top: 342,
            width: 1208,
            height: 676,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 30%, #1f7a55 0%, #0f5039 55%, #0a3527 100%)',
            border: `3px solid ${GOLD}88`,
            display: 'flex',
          }}
        />
        {/* warm pendant light */}
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: -260,
            width: 760,
            height: 760,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,214,160,0.22) 0%, rgba(255,214,160,0) 65%)',
            display: 'flex',
          }}
        />

        <Chip x={1000} y={468} color="#b11d2c" />
        <Chip x={1068} y={500} color="#17704a" />
        <Card back x={720} y={120} rot={-14} />
        <Card rank="A" suit="♠" x={836} y={96} rot={-2} />
        <Card rank="K" suit="♥" red x={962} y={118} rot={11} />

        <div style={{ position: 'absolute', left: 72, top: 70, display: 'flex', flexDirection: 'column', gap: 20, width: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: GOLD, fontSize: 22, letterSpacing: 6 }}>
            <div style={{ width: 20, height: 20, border: `3px solid ${GOLD}`, transform: 'rotate(45deg)', display: 'flex' }} />
            BLACKJACK 3D
          </div>
          <div style={{ display: 'flex', fontFamily: 'Cinzel', fontSize: 88, fontWeight: 700, color: GOLD2, letterSpacing: 3, lineHeight: 1, whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ display: 'flex', fontSize: 34, color: INK, lineHeight: 1.25, maxWidth: 560 }}>3D blackjack trainer for card counting</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, maxWidth: 560 }}>
            <Pill>Hi-Lo</Pill>
            <Pill>basic strategy</Pill>
            <Pill>index plays</Pill>
            <Pill>bet ramp</Pill>
          </div>
        </div>

        <div style={{ position: 'absolute', left: 72, bottom: 60, display: 'flex', gap: 12 }}>
          <Pill tone="plus">True count +2.4</Pill>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined }
  );
}
