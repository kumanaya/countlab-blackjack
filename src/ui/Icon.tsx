const PATHS: Record<string, React.ReactNode> = {
  diamond: (
    <>
      <path d="M12 2.5 4.5 12 12 21.5 19.5 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" fill="currentColor" />
      <path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8M17.8 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z" fill="currentColor" />
      <path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5c2.6-1 5.3-1 8 .6 2.7-1.6 5.4-1.6 8-.6v13c-2.6-1-5.3-1-8 .6-2.7-1.6-5.4-1.6-8-.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 6.1v13" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2 12s3.6-6.4 10-6.4S22 12 22 12s-3.6 6.4-10 6.4S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
  spark: <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" fill="currentColor" />,
  reset: (
    <path d="M5 12a7 7 0 1 0 2.1-5M5 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  plus: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  stop: <path d="M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  double: (
    <>
      <rect x="4" y="7" width="9" height="12" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="4" width="9" height="12" rx="1.6" fill="currentColor" opacity=".35" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  split: (
    <path d="M12 4v5m0 0-6 6v5m6-11 6 6v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  flag: (
    <path d="M6 21V4m0 0h10l-2 4 2 4H6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  shield: (
    <path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  ramp: <path d="M4 19h16M6 19v-3m4 3v-6m4 6v-9m4 9V6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  chart: <path d="M4 19h16M5 15l4-4 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9v4l2.5 2M10 2.5h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  next: <path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
