import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** App icon: gold diamond on green felt. */
export function Mark({ s }: { s: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 40%, #1f6b4c 0%, #0b2a1e 70%, #06140e 100%)',
      }}
    >
      <div
        style={{
          width: s * 0.42,
          height: s * 0.42,
          transform: 'rotate(45deg)',
          border: `${Math.round(s * 0.035)}px solid #d8b46a`,
          borderRadius: s * 0.04,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: s * 0.11, height: s * 0.11, borderRadius: '50%', background: '#f0d48a' }} />
      </div>
    </div>
  );
}

export default function Icon() {
  return new ImageResponse(<Mark s={512} />, size);
}
