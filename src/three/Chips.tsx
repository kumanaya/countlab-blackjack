'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { getGame, useUI } from '@/lib/store';
import { handValue } from '@/lib/game';
import { betSpot, CHIP, seatSpot, type Layout, type Vec3 } from './layout';
import { chipEdgeTexture, chipTopTexture } from './textures';

export const DENOMS = [500, 100, 25, 5] as const;

let geo: THREE.CylinderGeometry | null = null;
const mats = new Map<number, THREE.Material[]>();

export function chipGeometry() {
  if (!geo) geo = new THREE.CylinderGeometry(CHIP.r, CHIP.r, CHIP.h, 48, 1);
  return geo;
}

export function chipMaterials(value: number) {
  let m = mats.get(value);
  if (!m) {
    const side = new THREE.MeshPhysicalMaterial({
      map: chipEdgeTexture(value),
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    });
    const top = new THREE.MeshPhysicalMaterial({
      map: chipTopTexture(value),
      roughness: 0.4,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
    });
    m = [side, top, top];
    mats.set(value, m);
  }
  return m;
}

export function decompose(total: number, max = 18) {
  const chips: number[] = [];
  let rest = total;
  for (const d of DENOMS) {
    while (rest >= d && chips.length < max) {
      chips.push(d);
      rest -= d;
    }
  }
  return chips;
}

function jit(i: number, seed: number) {
  const s = Math.sin((i + 1) * 91.7 + seed * 12.3) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

/* A chip stack that slides to its target; `vanish` shrinks it on arrival. */
function ChipStack({ value, target, from, vanish, seed }: { value: number; target: Vec3; from?: Vec3; vanish?: boolean; seed: number }) {
  const g = useRef<THREE.Group>(null);
  const chips = useMemo(() => decompose(value), [value]);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const scl = useRef(from ? 0.6 : 0.4);

  useEffect(() => {
    if (from && g.current) g.current.position.set(...from);
    else if (g.current) g.current.position.set(...target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const o = g.current;
    if (!o) return;
    goal.set(...target);
    easing.damp3(o.position, goal, vanish ? 0.28 : 0.2, dt);
    const near = o.position.distanceTo(goal) < 0.08;
    const s = vanish && near ? 0.001 : 1;
    scl.current = THREE.MathUtils.damp(scl.current, s, vanish ? 8 : 14, dt);
    o.scale.setScalar(Math.max(0.001, scl.current));
    o.visible = scl.current > 0.01;
  });

  return (
    <group ref={g}>
      {chips.map((v, i) => (
        <mesh
          key={i}
          geometry={chipGeometry()}
          material={chipMaterials(v)}
          position={[jit(i, seed) * 0.016, CHIP.h / 2 + i * CHIP.h, jit(i + 7, seed) * 0.016]}
          rotation-y={jit(i + 3, seed) * Math.PI * 2}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

const RACK: Vec3 = [0, 0.06, -1.45];

/** Bet chips, payouts and losses — derived from the game phase. */
export function BetChips() {
  useUI((s) => s.v);
  const layout = useUI((s) => s.layout);
  const game = getGame();
  const settled = game.phase === 'settle' || game.phase === 'quiz';

  const seats = game.seats.map((st) => {
    if (!st.bet) return null;
    const spot = seatSpot(layout, st.side).bet;
    const lost = settled && st.resultTone === 'loss';
    const won = settled && st.resultTone === 'win';
    const pay = st.result === 'blackjack' ? st.bet * 1.5 : st.bet;
    return (
      <group key={`s${st.id}`}>
        <ChipStack value={st.bet} target={lost ? RACK : spot} vanish={lost} seed={40 + st.id} />
        {won && <ChipStack value={pay} target={[spot[0] - st.side * CHIP.r * 2.2, 0, spot[2] - 0.05]} from={RACK} seed={50 + st.id} />}
      </group>
    );
  });

  if (game.phase === 'bet') {
    return <ChipStack key="h0" value={game.bet} target={betSpot(layout, 0, 1)} seed={0} />;
  }

  const n = game.hands.length || 1;
  return (
    <group>
      {seats}
      {game.hands.map((h, i) => {
        const spot = betSpot(layout, i, n);
        const lost = settled && h.resultTone === 'loss' && !h.surrendered;
        const half = settled && h.surrendered;
        const won = settled && h.resultTone === 'win';
        const pay = h.result === 'blackjack' ? h.bet * 1.5 : h.bet;
        return (
          <group key={`h${i}`}>
            {half ? (
              <>
                <ChipStack key="keep" value={h.bet / 2} target={spot} seed={i} />
                <ChipStack key="lose" value={h.bet / 2} target={RACK} vanish seed={i + 5} />
              </>
            ) : (
              <ChipStack value={h.bet} target={lost ? RACK : spot} vanish={lost} seed={i} />
            )}
            {h.insurance > 0 && (
              <ChipStack
                value={h.insurance}
                target={settled && handDealerNoBJ(game) ? RACK : [spot[0], 0, spot[2] - 0.62]}
                vanish={settled && handDealerNoBJ(game)}
                seed={i + 21}
              />
            )}
            {h.insurance > 0 && settled && !handDealerNoBJ(game) && (
              <ChipStack value={h.insurance * 2} target={[spot[0] + CHIP.r * 2.2, 0, spot[2] - 0.62]} from={RACK} seed={i + 31} />
            )}
            {won && (
              <ChipStack value={pay} target={[spot[0] + CHIP.r * 2.2, 0, spot[2] - 0.05]} from={RACK} seed={i + 11} />
            )}
          </group>
        );
      })}
    </group>
  );
}

function handDealerNoBJ(game: ReturnType<typeof getGame>) {
  return !(game.dealer.length === 2 && handValue(game.dealer).total === 21);
}

/* ---------------- dealer chip rack ---------------- */

export function ChipRack({ layout }: { layout: Layout }) {
  const cols: number[] = layout.portrait ? [100, 25, 25, 5, 5] : [500, 100, 100, 25, 25, 5, 5];
  const per = 7;
  const gap = CHIP.r * 2 + 0.03;
  const width = cols.length * gap + 0.08;
  const depth = per * CHIP.h + 0.1;
  const z0 = -1.6 + 0.04;

  const groups = useMemo(() => {
    const byValue = new Map<number, THREE.Matrix4[]>();
    const o = new THREE.Object3D();
    cols.forEach((v, c) => {
      const list = byValue.get(v) ?? [];
      for (let i = 0; i < per; i++) {
        o.position.set((c - (cols.length - 1) / 2) * gap, CHIP.r * 0.62, z0 + 0.05 + CHIP.h / 2 + i * CHIP.h);
        o.rotation.set(Math.PI / 2, 0, Math.sin(i * 7.1 + c) * 0.6);
        o.updateMatrix();
        list.push(o.matrix.clone());
      }
      byValue.set(v, list);
    });
    return [...byValue.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.portrait]);

  return (
    <group>
      {/* tray */}
      <mesh position={[0, 0.03, z0 + depth / 2]} receiveShadow castShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshPhysicalMaterial color="#1c0f08" roughness={0.5} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      {Array.from({ length: cols.length + 1 }, (_, i) => (
        <mesh key={i} position={[(i - cols.length / 2) * gap, 0.1, z0 + depth / 2]} castShadow>
          <boxGeometry args={[0.018, 0.1, depth]} />
          <meshStandardMaterial color="#c9a45c" metalness={1} roughness={0.28} />
        </mesh>
      ))}
      {groups.map(([value, list]) => (
        <instancedMesh
          key={`${value}-${list.length}`}
          args={[chipGeometry(), chipMaterials(value), list.length]}
          castShadow
          receiveShadow
          ref={(m) => {
            if (!m) return;
            list.forEach((mat, i) => m.setMatrixAt(i, mat));
            m.instanceMatrix.needsUpdate = true;
          }}
        />
      ))}
    </group>
  );
}
