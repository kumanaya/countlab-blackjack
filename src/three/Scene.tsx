'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, Sparkles } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { easing } from 'maath';
import { getGame, useUI } from '@/lib/store';
import { handValue, isBlackjack } from '@/lib/game';
import { handLabelAnchor, makeLayout, seatSpot } from './layout';
import type { Quality } from '@/lib/game';
import { Table } from './Table';
import { Cards } from './Cards';
import { BetChips } from './Chips';
import { bokehTexture, glowTexture } from './textures';

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- camera ---------------- */

function CameraRig() {
  const { camera, size } = useThree();
  const layout = useUI((s) => s.layout);
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(...layout.camera.target));
  const still = useMemo(reduceMotion, []);

  useEffect(() => {
    const next = makeLayout(size.width / size.height);
    const cur = useUI.getState().layout;
    if (next.portrait !== cur.portrait || next.camera.pos[1] !== cur.camera.pos[1]) useUI.setState({ layout: next });
  }, [size.width, size.height]);

  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const k = still ? 0 : 1;
    const t = state.clock.elapsedTime;
    target.set(
      layout.camera.pos[0] + state.pointer.x * 0.22 * k + Math.sin(t * 0.21) * 0.04 * k,
      layout.camera.pos[1] + state.pointer.y * 0.1 * k + Math.sin(t * 0.17) * 0.03 * k,
      layout.camera.pos[2]
    );
    easing.damp3(cam.position, target, 0.6, dt);
    easing.damp3(look.current, layout.camera.target, 0.6, dt);
    cam.lookAt(look.current);
    if (Math.abs(cam.fov - layout.camera.fov) > 0.01) {
      cam.fov = THREE.MathUtils.damp(cam.fov, layout.camera.fov, 4, dt);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/* ---------------- lighting ---------------- */

function Lights() {
  useUI((s) => s.v);
  const rim = useRef<THREE.DirectionalLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const tc = getGame().mode === 'count' ? getGame().trueCount() : 0;
  const hot = useMemo(() => new THREE.Color('#ffb15a'), []);
  const cold = useMemo(() => new THREE.Color('#5d8cff'), []);
  const neutral = useMemo(() => new THREE.Color('#9fb6ff'), []);
  const want = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (spot.current) {
      spot.current.target.position.set(0, 0, 0.1);
      spot.current.target.updateMatrixWorld();
    }
  }, []);

  useFrame((_, dt) => {
    const m = THREE.MathUtils.clamp(tc / 4, -1, 1);
    want.copy(neutral);
    if (m > 0) want.lerp(hot, m);
    else want.lerp(cold, -m);
    if (rim.current) easing.dampC(rim.current.color, want, 0.8, dt);
  });

  return (
    <>
      <hemisphereLight args={['#3a3f55', '#140806', 0.35]} />
      {/* pendant lamp over the table: key light with shadows */}
      <spotLight
        ref={spot}
        position={[0, 6.2, 0.4]}
        angle={0.62}
        penumbra={0.75}
        intensity={90}
        decay={2}
        color="#ffdcae"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-camera-near={2}
        shadow-camera-far={10}
      />
      {/* rim light that follows the count */}
      <directionalLight ref={rim} position={[-3, 3.5, -6]} intensity={1.1} color="#9fb6ff" />
      <pointLight position={[3.5, 1.2, 2.5]} intensity={3} distance={9} color="#ff9a5a" />
    </>
  );
}

function Env() {
  return (
    <Environment resolution={256} frames={1}>
      {/* ceiling: warm lamp panel */}
      <Lightformer form="rect" intensity={4} color="#ffd6a0" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer form="ring" intensity={2.4} color="#ffe2b8" position={[0, 4, 3]} scale={1.6} />
      <Lightformer form="rect" intensity={1.2} color="#6f8cff" position={[-6, 2, -4]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ff7a3c" position={[6, 1.5, 2]} rotation-y={-Math.PI / 2.5} scale={[2, 4, 1]} />
      <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 1, 8]} scale={3} />
    </Environment>
  );
}

/* ---------------- background: out-of-focus casino lights ---------------- */

function Bokeh() {
  const { positions, colors, sizes } = useMemo(() => {
    const N = 70;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes: number[] = [];
    const palette = ['#ffb35c', '#ff7a3c', '#ffd28a', '#d84a5a', '#5fa8ff', '#ffe6b0'].map((c) => new THREE.Color(c));
    let s = 17;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < N; i++) {
      const a = (r() - 0.5) * Math.PI * 1.25;
      const d = 9 + r() * 9;
      positions.set([Math.sin(a) * d, -0.5 + r() * 4.5, -Math.cos(a) * d - 1], i * 3);
      const c = palette[Math.floor(r() * palette.length)];
      colors.set([c.r, c.g, c.b], i * 3);
      sizes.push(0.5 + r() * 1.3);
    }
    return { positions, colors, sizes };
  }, []);

  const tex = useMemo(() => bokehTexture(), []);
  return (
    <group>
      {sizes.map((sz, i) => (
        <sprite key={i} position={[positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]} scale={sz}>
          <spriteMaterial
            map={tex}
            color={new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])}
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/* ---------------- result glow on the felt ---------------- */

function ResultFlash() {
  const flash = useUI((s) => s.flash);
  const layout = useUI((s) => s.layout);
  const mesh = useRef<THREE.Mesh>(null);
  const t0 = useRef(-10);
  const tex = useMemo(() => glowTexture(), []);

  useEffect(() => {
    if (flash) t0.current = performance.now() / 1000;
  }, [flash]);

  const color = !flash ? '#ffffff' : flash.blackjack ? '#ffd27a' : flash.tone === 'win' ? '#5fe39a' : flash.tone === 'loss' ? '#ff4a4a' : '#e8c27a';

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const p = (performance.now() / 1000 - t0.current) / 1.4;
    const mat = m.material as THREE.MeshBasicMaterial;
    if (p < 0 || p > 1) {
      mat.opacity = 0;
      m.visible = false;
      return;
    }
    m.visible = true;
    mat.opacity = (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85) * (flash?.blackjack ? 0.7 : 0.45);
    m.scale.setScalar(3 + p * 1.6);
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, 0.012, layout.playerZ + 0.3]} visible={false}>
      <planeGeometry args={[1, 0.7]} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* ---------------- hand totals anchored to the table ---------------- */

function HandLabels() {
  useUI((s) => s.v);
  const layout = useUI((s) => s.layout);
  const g = getGame();
  if (!g.dealer.length && !g.hands.length) return null;
  const seatTags = g.seats.map((s, i) => {
    if (!s.cards.length) return null;
    const v = handValue(s.cards);
    const cls = ['hand-tag', 'seat'];
    if (g.actingSeat === i) cls.push('active');
    if (v.total > 21) cls.push('bust');
    else if (isBlackjack(s.cards)) cls.push('bj');
    if (s.resultTone) cls.push(s.resultTone);
    // narrow screens: grow the tag inward from the table edge so it never clips
    if (layout.portrait) cls.push(s.side === 1 ? 'edge-r' : 'edge-l');
    return (
      <Html key={`seat${s.id}`} position={seatSpot(layout, s.side).label} center zIndexRange={[10, 0]} pointerEvents="none">
        <div className={cls.join(' ')}>
          <span className="who">{s.name}</span>
          <b>{v.soft && v.total < 21 && !s.result ? `${v.total - 10}/${v.total}` : v.total}</b>
          {s.doubled && <span className="hint">2x</span>}
          {s.result && <span className="result">{s.result}</span>}
        </div>
      </Html>
    );
  });
  const n = g.hands.length || 1;
  const hidden = g.dealer.some((c) => !c.faceUp);
  const dv = handValue(g.dealer.filter((c) => c.faceUp)).total;

  return (
    <>
      {seatTags}
      {g.dealer.length > 0 && (
        <Html position={handLabelAnchor(layout, 'dealer', 0, 1, g.dealer.length)} center zIndexRange={[10, 0]} pointerEvents="none">
          <div className={`hand-tag dealer ${!hidden && dv > 21 ? 'bust' : ''}`}>
            <span className="who">Dealer</span>
            <b>{hidden ? `${dv}` : handValue(g.dealer).total}</b>
            {hidden && <span className="hint">+?</span>}
          </div>
        </Html>
      )}
      {g.hands.map((h, i) => {
        if (!h.cards.length) return null;
        const v = handValue(h.cards);
        const active = g.phase === 'player' && i === g.active && !h.done;
        const cls = ['hand-tag'];
        if (active && n > 1) cls.push('active');
        if (v.total > 21) cls.push('bust');
        else if (isBlackjack(h.cards) && !h.fromSplit) cls.push('bj');
        if (h.resultTone) cls.push(h.resultTone);
        return (
          <Html key={i} position={handLabelAnchor(layout, 'player', i, n)} center zIndexRange={[10, 0]} pointerEvents="none">
            <div className={cls.join(' ')}>
              {n > 1 && <span className="who">Hand {i + 1}</span>}
              <b>{v.soft && v.total < 21 && !h.result ? `${v.total - 10}/${v.total}` : v.total}</b>
              {h.doubled && <span className="hint">2x</span>}
              {h.insurance > 0 && !h.result && <span className="hint">ins</span>}
              {h.result && <span className="result">{h.result}</span>}
            </div>
          </Html>
        );
      })}
    </>
  );
}

/* ---------------- scene ---------------- */

function World({ quality }: { quality: Quality }) {
  return (
    <>
      <color attach="background" args={['#050607']} />
      <fog attach="fog" args={['#07080a', 7, 22]} />
      <CameraRig />
      <Lights />
      <Env />
      <Table />
      <Cards />
      <BetChips />
      <ResultFlash />
      <HandLabels />
      {quality !== 'low' && <Bokeh />}
      {quality === 'high' && <Sparkles count={70} scale={[6, 3.2, 4.5]} position={[0, 1.8, 0]} size={2.2} speed={0.18} opacity={0.35} color="#ffd9a8" noise={0.6} />}
    </>
  );
}

/** Graphics quality: high = soft shadows + full post; medium = hard shadows, bloom only;
 * low = no shadows, no post-processing (renderer tone mapping instead). */
export default function Scene({ onReady, quality = 'high' }: { onReady?: () => void; quality?: Quality }) {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const dpr: [number, number] = quality === 'low' ? [1, 1] : quality === 'medium' ? [1, 1.4] : mobile ? [1, 1.6] : [1, 2];
  return (
    <Canvas
      className="table-canvas"
      shadows={quality === 'high' ? 'soft' : quality === 'medium'}
      dpr={dpr}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', stencil: false }}
      camera={{ position: [0, 3.55, 3.75], fov: 40, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMapping = quality === 'low' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        onReady?.();
      }}
    >
      <Suspense fallback={null}>
        <World quality={quality} />
        {quality !== 'low' && (
          <EffectComposer multisampling={mobile || quality === 'medium' ? 0 : 4} enableNormalPass={false}>
            <Bloom mipmapBlur intensity={0.45} luminanceThreshold={0.95} luminanceSmoothing={0.2} radius={0.7} />
            <Vignette offset={0.28} darkness={0.72} />
            {quality === 'high' ? <Noise opacity={0.028} premultiply /> : <></>}
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
