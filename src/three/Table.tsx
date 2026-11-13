'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getGame, useUI } from '@/lib/store';
import { CARD, TABLE, seatSpot, type Layout } from './layout';
import { cardBackTexture, feltTexture, leatherBump, woodTexture } from './textures';
import { ChipRack } from './Chips';

const SEG = 96;

/** Half ellipse on the XZ plane, converted to a Shape (x, −z). */
function halfEllipseShape(rx: number, rz: number) {
  const s = new THREE.Shape();
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI;
    const x = rx * Math.cos(t);
    const z = TABLE.arcZ + rz * Math.sin(t);
    if (i === 0) s.moveTo(x, -z);
    else s.lineTo(x, -z);
  }
  s.closePath();
  return s;
}

function ringShape(rIn: [number, number], rOut: [number, number]) {
  const s = new THREE.Shape();
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI;
    const x = rOut[0] * Math.cos(t);
    const z = TABLE.arcZ + rOut[1] * Math.sin(t);
    if (i === 0) s.moveTo(x, -z);
    else s.lineTo(x, -z);
  }
  for (let i = SEG; i >= 0; i--) {
    const t = (i / SEG) * Math.PI;
    s.lineTo(rIn[0] * Math.cos(t), -(TABLE.arcZ + rIn[1] * Math.sin(t)));
  }
  s.closePath();
  return s;
}

class ArcCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private rx: number, private rz: number, private y: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * Math.PI;
    return target.set(this.rx * Math.cos(a), this.y, TABLE.arcZ + this.rz * Math.sin(a));
  }
}

function useTableGeometry() {
  return useMemo(() => {
    const { rx, rz, railR } = TABLE;

    const felt = new THREE.ShapeGeometry(halfEllipseShape(rx, rz), SEG);
    felt.rotateX(-Math.PI / 2);
    const box = TABLE.feltBox;
    const pos = felt.attributes.position as THREE.BufferAttribute;
    const uv = felt.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - box.x0) / box.w, 1 - (pos.getZ(i) - box.z0) / box.h);
    }

    const railCurve = new ArcCurve(rx + railR * 0.55, rz + railR * 0.55, 0);
    const rail = new THREE.TubeGeometry(railCurve, 160, railR, 24, false);

    const trim = new THREE.TubeGeometry(new ArcCurve(rx - 0.03, rz - 0.03, 0.004), 160, 0.012, 8, false);

    const apronShape = ringShape([rx - 0.05, rz - 0.05], [rx + railR * 1.1 + 0.32, rz + railR * 1.1 + 0.32]);
    const apron = new THREE.ExtrudeGeometry(apronShape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: SEG });
    apron.rotateX(-Math.PI / 2);
    apron.translate(0, -0.32, 0);

    const base = new THREE.ExtrudeGeometry(halfEllipseShape(rx + 0.3, rz + 0.3), { depth: 0.16, bevelEnabled: false, curveSegments: SEG });
    base.rotateX(-Math.PI / 2);
    base.translate(0, -0.5, 0);

    return { felt, rail, trim, apron, base };
  }, []);
}

function useMaterials() {
  return useMemo(() => {
    const wood = woodTexture();
    const woodMap = wood.clone();
    woodMap.repeat.set(0.3, 0.6);
    woodMap.needsUpdate = true;
    const bump = leatherBump();
    bump.repeat.set(40, 2);
    return {
      felt: new THREE.MeshPhysicalMaterial({
        map: feltTexture(),
        roughness: 0.95,
        sheen: 1,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color('#2f8a63'),
      }),
      leather: new THREE.MeshPhysicalMaterial({
        color: '#2a0d0c',
        roughness: 0.48,
        bumpMap: bump,
        bumpScale: 0.6,
        clearcoat: 0.45,
        clearcoatRoughness: 0.35,
        sheen: 0.4,
        sheenColor: new THREE.Color('#6b2a22'),
      }),
      brass: new THREE.MeshStandardMaterial({ color: '#d4ad62', metalness: 1, roughness: 0.22 }),
      wood: new THREE.MeshPhysicalMaterial({
        map: woodMap,
        roughness: 0.42,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      }),
      darkWood: new THREE.MeshStandardMaterial({ color: '#120804', roughness: 0.7 }),
    };
  }, []);
}

/* ---------------- shoe and discard ---------------- */

function Shoe({ layout }: { layout: Layout }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    // side profile (z, y): tall back, low slanted mouth
    s.moveTo(-0.34, 0);
    s.lineTo(-0.34, 0.27);
    s.lineTo(0.16, 0.19);
    s.lineTo(0.26, 0.08);
    s.lineTo(0.26, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.44, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
    g.translate(0, 0, -0.22);
    g.rotateY(-Math.PI / 2);
    return g;
  }, []);
  const backMat = useMemo(() => new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.5 }), []);

  return (
    <group position={layout.shoe} rotation-y={layout.portrait ? 0.35 : 0.55}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial color="#0b0b0d" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      {/* card visible at the mouth */}
      <mesh position={[0, 0.142, 0.21]} rotation-x={-0.95} material={backMat}>
        <planeGeometry args={[CARD.w * 0.78, 0.14]} />
      </mesh>
      {/* brass plate */}
      <mesh position={[0, 0.045, 0.272]}>
        <boxGeometry args={[0.36, 0.05, 0.006]} />
        <meshStandardMaterial color="#d4ad62" metalness={1} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Discard({ layout }: { layout: Layout }) {
  useUI((s) => s.v);
  const g = getGame();
  const onTable = g.cardsOnTable();
  const discarded = Math.max(0, g.decks * 52 - g.shoe.length - onTable);
  const h = Math.max(0.002, Math.min(0.24, discarded * 0.0011));
  const backMat = useMemo(() => new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.5 }), []);

  return (
    <group position={layout.discard} rotation-y={layout.portrait ? -0.35 : -0.55}>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.62, 0.28, 0.82]} />
        <meshPhysicalMaterial color="#9fc6d8" roughness={0.25} transparent opacity={0.1} envMapIntensity={0.25} depthWrite={false} />
      </mesh>
      <mesh position={[0, h / 2 + 0.004, 0]} castShadow>
        <boxGeometry args={[CARD.w, h, CARD.h]} />
        <meshStandardMaterial color="#e9e1cf" roughness={0.85} />
      </mesh>
      <mesh position={[0, h + 0.005, 0]} rotation-x={-Math.PI / 2} material={backMat}>
        <planeGeometry args={[CARD.w, CARD.h]} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[0.62, 0.82]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ---------------- full table ---------------- */

/* ---------------- AI seat betting circles ---------------- */

function SeatRings({ layout }: { layout: Layout }) {
  useUI((s) => s.v);
  const seats = getGame().seats;
  return (
    <>
      {seats.map((s) => {
        const p = seatSpot(layout, s.side).bet;
        return (
          <mesh key={s.id} position={[p[0], 0.002, p[2]]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.2, 0.225, 64]} />
            <meshStandardMaterial color="#d8b46a" metalness={0.6} roughness={0.4} transparent opacity={0.7} />
          </mesh>
        );
      })}
    </>
  );
}

export function Table() {
  const layout = useUI((s) => s.layout);
  useUI((s) => s.v);
  const h17 = getGame().rules.h17;
  const geo = useTableGeometry();
  const m = useMaterials();
  useEffect(() => {
    m.felt.map = feltTexture(h17);
    m.felt.needsUpdate = true;
  }, [h17, m]);
  const { rx, railR } = TABLE;
  const outer = rx + railR * 1.1 + 0.32;

  return (
    <group>
      <mesh geometry={geo.felt} material={m.felt} receiveShadow />
      <mesh geometry={geo.trim} material={m.brass} />
      <mesh geometry={geo.rail} material={m.leather} scale={[1, 0.62, 1]} position-y={0.03} castShadow receiveShadow />
      {/* rail end caps at the dealer edge */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (rx + railR * 0.55), 0.03, TABLE.arcZ]} scale={[1, 0.62, 1]} material={m.leather}>
          <sphereGeometry args={[railR, 24, 16]} />
        </mesh>
      ))}
      <mesh geometry={geo.apron} material={m.wood} castShadow receiveShadow />
      <mesh geometry={geo.base} material={m.darkWood} />
      {/* straight dealer edge */}
      <mesh position={[0, -0.12, TABLE.arcZ - 0.13]} material={m.wood} castShadow receiveShadow>
        <boxGeometry args={[outer * 2, 0.32, 0.26]} />
      </mesh>
      <mesh position={[0, 0.042, TABLE.arcZ - 0.005]} material={m.brass}>
        <boxGeometry args={[outer * 2 - 0.1, 0.012, 0.012]} />
      </mesh>
      {/* pedestal and floor */}
      <mesh position={[0, -1.0, -0.2]}>
        <cylinderGeometry args={[0.55, 0.9, 1.0, 32]} />
        <meshStandardMaterial color="#0b0605" roughness={0.6} />
      </mesh>
      <Floor />
      <group position-z={TABLE.arcZ} scale={0.72}>
        <group position-z={-TABLE.arcZ}>
          <ChipRack layout={layout} />
        </group>
      </group>
      <SeatRings layout={layout} />
      <Shoe layout={layout} />
      <Discard layout={layout} />
    </group>
  );
}

function Floor() {
  const tex = useMemo(() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1a0a0c';
    ctx.fillRect(0, 0, S, S);
    // casino carpet: subtle diamonds and rings
    ctx.strokeStyle = 'rgba(200,150,80,.18)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * 128 + 64;
        const y = j * 128 + 64;
        ctx.beginPath();
        ctx.moveTo(x, y - 52);
        ctx.lineTo(x + 52, y);
        ctx.lineTo(x, y + 52);
        ctx.lineTo(x - 52, y);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.anisotropy = 8;
    return t;
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-1.5} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}
