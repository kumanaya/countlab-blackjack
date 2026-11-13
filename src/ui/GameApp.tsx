'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { actions, getGame, getSfx, useUI } from '@/lib/store';
import { setCanvasSerif } from '@/three/textures';
import { Banner, CountRail, TopBar, Toast } from './Hud';
import { Controls } from './Controls';
import { Guide } from './Guide';
import { Quiz } from './Quiz';
import { Drills } from './Drills';
import { usePwa } from './usePwa';

const Scene = dynamic(() => import('@/three/Scene'), { ssr: false });

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useUI.getState();
      if (st.quizOpen || st.drillOpen) {
        if (st.drillOpen && e.key === 'Escape') actions.openDrill(null);
        return;
      }
      if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (st.guideOpen) {
        if (e.key === 'Escape') actions.openGuide(false);
        return;
      }
      const g = getGame();
      const k = e.key.toLowerCase();
      if (g.phase === 'player') {
        if (k === 'h') actions.hit();
        if (k === 's') actions.stand();
        if (k === 'd') actions.double();
        if (k === 'p') actions.split();
        if (k === 'r') actions.surrender();
      } else if (g.phase === 'insurance') {
        if (k === 'i' || k === 'y') actions.insurance(true);
        if (k === 'n') actions.insurance(false);
      } else if (e.key === 'Enter') {
        // focused buttons already handle Enter on their own
        if (document.activeElement instanceof HTMLButtonElement || e.target instanceof HTMLButtonElement) return;
        if (g.phase === 'bet') actions.deal();
        else if (g.phase === 'settle') actions.next();
      }
    };
    window.addEventListener('keydown', onKey);
    const unlock = () => getSfx().ensure();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);
}

export default function GameApp() {
  const [fontsReady, setFontsReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  useKeyboard();
  usePwa();
  useUI((s) => s.v);
  const quality = fontsReady ? getGame().quality : 'high';

  useEffect(() => {
    getGame();
    // canvas textures need the display font loaded first
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
    setCanvasSerif(family || 'Georgia');
    const load = family ? Promise.all([document.fonts.load(`700 64px ${family}`), document.fonts.load(`600 32px ${family}`)]) : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([load, timeout]).finally(() => setFontsReady(true));
  }, []);

  return (
    <main className="stage">
      {/* a new key remounts the Canvas so renderer-level options (shadows, dpr, AA) apply */}
      {fontsReady && <Scene key={quality} quality={quality} onReady={() => setTimeout(() => setSceneReady(true), 350)} />}
      <div className="grade" aria-hidden="true" />
      {/* the UI reads localStorage through Game: render on the client only */}
      {fontsReady && (
        <>
          <TopBar />
          <CountRail />
          <Banner />
          <Controls />
          <Toast />
          <Guide />
          <Quiz />
          <Drills />
        </>
      )}
      <AnimatePresence>
        {!sceneReady && (
          <motion.div className="loader" exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
            <div className="loader-mark">
              <span />
            </div>
            <b>Count Lab</b>
            <small>setting up the table…</small>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
