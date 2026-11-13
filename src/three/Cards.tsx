'use client';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import type { Card } from '@/lib/game';
import { getGame, useUI } from '@/lib/store';
import { CARD, cardSlot, shoeMouth, type Layout, type Vec3 } from './layout';
import { cardBackTexture, cardFaceTexture } from './textures';

/* ---------------- shared geometry and materials ---------------- */

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

let shared: {
  body: THREE.BufferGeometry;
  face: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  edgeMat: THREE.Material;
  backMat: THREE.Material;
  faceMats: Map<string, THREE.Material>;
} | null = null;

function getShared() {
  if (shared) return shared;
  const shape = roundedRect(CARD.w, CARD.h, CARD.r);
  const body = new THREE.ExtrudeGeometry(shape, { depth: CARD.t, bevelEnabled: false, curveSegments: 6 });
  body.translate(0, 0, -CARD.t / 2);

  const face = new THREE.ShapeGeometry(shape, 6);
  const uv = face.attributes.uv as THREE.BufferAttribute;
  const pos = face.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / CARD.w + 0.5, pos.getY(i) / CARD.h + 0.5);
  }
  face.translate(0, 0, CARD.t / 2 + 0.0003);
  const back = face.clone();
  back.rotateY(Math.PI);

  shared = {
    body,
    face,
    back,
    edgeMat: new THREE.MeshStandardMaterial({ color: '#e9e1cf', roughness: 0.8 }),
    backMat: new THREE.MeshPhysicalMaterial({
      map: cardBackTexture(),
      roughness: 0.38,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
    }),
    faceMats: new Map(),
  };
  return shared;
}

function faceMat(card: Card) {
  const s = getShared();
  const key = card.rank + card.suit;
  let m = s.faceMats.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      map: cardFaceTexture(card.rank, card.suit),
      roughness: 0.42,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
    });
    s.faceMats.set(key, m);
  }
  return m;
}

/* ---------------- a single card ---------------- */

interface View {
  card: Card;
  to: 'player' | 'dealer' | 'seat';
  hand: number;
  index: number;
  handCount: number;
  n: number;
  leaving?: number; // position in the discard pile
}

const FLIGHT = 0.44;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CardMesh({ view, layout }: { view: View; layout: Layout }) {
  const s = getShared();
  const outer = useRef<THREE.Group>(null);
  const flipper = useRef<THREE.Group>(null);
  const g = getGame();
  const showPops = g.mode === 'count' && g.showCount;
  const pops = useUI((st) => st.pops);
  const myPops = pops.filter((p) => p.cardId === view.card.id);

  const target = useMemo(() => {
    if (view.leaving !== undefined) {
      const d = layout.discard;
      return { pos: [d[0], 0.16 + view.leaving * 0.002, d[2]] as Vec3, yaw: 0 };
    }
    return cardSlot(layout, view.to, view.hand, view.index, view.handCount, view.n, view.card.id);
  }, [layout, view.to, view.hand, view.index, view.handCount, view.n, view.card.id, view.leaving]);

  // flight: starts at the shoe mouth; when leaving the table, restarts from the current position
  const flight = useRef<{ t0: number; from: THREE.Vector3; dur: number; arc: number } | null>(null);
  const leavingKey = view.leaving !== undefined;
  useEffect(() => {
    const now = performance.now() / 1000;
    if (!flight.current) {
      flight.current = { t0: now, from: new THREE.Vector3(...shoeMouth(layout)), dur: FLIGHT, arc: 0.22 };
      outer.current?.position.copy(flight.current.from);
      if (outer.current) outer.current.rotation.y = -0.6;
      if (flipper.current) flipper.current.rotation.z = Math.PI;
    } else if (leavingKey && outer.current) {
      flight.current = {
        t0: now + (view.leaving ?? 0) * 0.025,
        from: outer.current.position.clone(),
        dur: 0.5,
        arc: 0.35,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavingKey]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const o = outer.current;
    const f = flipper.current;
    const fl = flight.current;
    if (!o || !f || !fl) return;
    goal.set(...target.pos);
    const now = performance.now() / 1000;
    const p = Math.min(1, Math.max(0, (now - fl.t0) / fl.dur));
    const wantFace = view.leaving === undefined && view.card.faceUp;

    if (p < 1) {
      const e = view.leaving !== undefined ? easeInOut(p) : easeOut(p);
      tmp.lerpVectors(fl.from, goal, e);
      tmp.y += Math.sin(p * Math.PI) * fl.arc;
      o.position.copy(tmp);
      easing.dampAngle(o.rotation, 'y', target.yaw, 0.09, dt);
      if (view.leaving === undefined) {
        f.rotation.z = wantFace ? Math.PI * (1 - easeOut(Math.min(1, p * 1.3))) : Math.PI;
      } else {
        easing.dampAngle(f.rotation, 'z', Math.PI, 0.1, dt);
      }
    } else {
      easing.damp3(o.position, goal, 0.12, dt);
      easing.dampAngle(o.rotation, 'y', target.yaw, 0.12, dt);
      easing.dampAngle(f.rotation, 'z', wantFace ? 0 : Math.PI, 0.11, dt);
    }
    // AI seat cards are smaller on narrow screens; the discard pile is full size
    const want = view.leaving === undefined ? (target as { scale?: number }).scale ?? 1 : 1;
    if (Math.abs(o.scale.x - want) > 0.001) o.scale.setScalar(THREE.MathUtils.damp(o.scale.x, want, 10, dt));
    // lift while flipping so it doesn't clip through the felt
    f.position.y = Math.abs(Math.sin(f.rotation.z)) * CARD.w * 0.52 * o.scale.x;
  });

  return (
    <group ref={outer}>
      <group ref={flipper}>
        <group rotation-x={-Math.PI / 2}>
          <mesh geometry={s.body} material={s.edgeMat} castShadow receiveShadow />
          <mesh geometry={s.face} material={faceMat(view.card)} receiveShadow />
          <mesh geometry={s.back} material={s.backMat} receiveShadow />
        </group>
      </group>
      {showPops &&
        myPops.map((p) => (
          <Html key={p.id} position={[0.2, 0.05, -0.2]} center zIndexRange={[20, 0]} pointerEvents="none">
            <div className={`count-pop ${p.value > 0 ? 'plus' : p.value < 0 ? 'minus' : 'zero'}`}>
              {p.value > 0 ? '+1' : p.value < 0 ? '−1' : '0'}
            </div>
          </Html>
        ))}
    </group>
  );
}

/* ---------------- all cards, including those heading to the discard ---------------- */

export function Cards() {
  useUI((s) => s.v);
  const layout = useUI((s) => s.layout);
  const game = getGame();

  const current: View[] = [];
  const handCount = game.hands.length || 1;
  game.hands.forEach((h, hi) =>
    h.cards.forEach((card, ci) =>
      current.push({ card, to: 'player', hand: hi, index: ci, handCount, n: h.cards.length })
    )
  );
  game.seats.forEach((st) =>
    st.cards.forEach((card, ci) =>
      current.push({ card, to: 'seat', hand: st.side, index: ci, handCount, n: st.cards.length })
    )
  );
  game.dealer.forEach((card, ci) =>
    current.push({ card, to: 'dealer', hand: -1, index: ci, handCount, n: game.dealer.length })
  );

  const prev = useRef(new Map<number, View>());
  const leaving = useRef(new Map<number, View>());
  const [, force] = useReducer((x: number) => x + 1, 0);

  const ids = new Set(current.map((v) => v.card.id));
  let order = 0;
  for (const [id, v] of prev.current) {
    if (!ids.has(id) && !leaving.current.has(id)) {
      leaving.current.set(id, { ...v, leaving: order++ });
    }
  }
  prev.current = new Map(current.map((v) => [v.card.id, v]));

  const leavingCount = leaving.current.size;
  useEffect(() => {
    if (!leavingCount) return;
    const t = setTimeout(() => {
      leaving.current.clear();
      force();
    }, 1100);
    return () => clearTimeout(t);
  }, [leavingCount]);

  return (
    <group>
      {/* a single list: a card keeps its instance when it starts leaving the table */}
      {[...current, ...leaving.current.values()].map((v) => (
        <CardMesh key={v.card.id} view={v} layout={layout} />
      ))}
    </group>
  );
}
