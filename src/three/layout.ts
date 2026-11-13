/* Table geometry and positions for cards, chips and camera.
 * World: felt at y = 0, player at +z, dealer at −z. */

export const CARD = { w: 0.6, h: 0.84, t: 0.004, r: 0.04 } as const;
export const CHIP = { r: 0.17, h: 0.034 } as const;

export const TABLE = {
  arcZ: -1.6,
  rx: 3.6,
  rz: 3.4,
  railR: 0.16,
  betZ: 1.32,
  betSpots: [0],
  textArcs: { inner: 1.06, outer: 1.43 },
  get feltBox() {
    return { x0: -this.rx, w: this.rx * 2, z0: this.arcZ, h: this.rz };
  },
} as const;

export type Vec3 = [number, number, number];

export interface Layout {
  portrait: boolean;
  playerZ: number;
  dealerZ: number;
  handSpacing: number;
  fan: number;
  dealerGap: number;
  shoe: Vec3;
  discard: Vec3;
  camera: { pos: Vec3; target: Vec3; fov: number };
}

export function makeLayout(aspect: number): Layout {
  const portrait = aspect < 0.85;
  if (portrait) {
    // the narrower the screen, the higher and farther the camera
    const k = Math.min(1.4, 0.85 / aspect);
    return {
      portrait,
      playerZ: 0.55,
      dealerZ: -0.8,
      handSpacing: 1.0,
      fan: 0.24,
      dealerGap: 0.4,
      shoe: [1.4, 0, -1.28],
      discard: [-1.4, 0, -1.28],
      // look past the table centre so the felt sits above the bottom controls
      camera: { pos: [0, 3.9 * k, 3.3 * k], target: [0, 0, 0.35], fov: 46 },
    };
  }
  // screens narrower than 16:9 pull the camera back to fit the table
  const k = Math.pow(Math.min(1.5, Math.max(1, 1.78 / aspect)), 0.85);
  return {
    portrait,
    playerZ: 0.5,
    dealerZ: -0.8,
    handSpacing: 1.45,
    fan: 0.3,
    dealerGap: 0.66,
    shoe: [2.6, 0, -1.08],
    discard: [-2.6, 0, -1.08],
    camera: { pos: [0, 4.1 * k, 4.3 * k], target: [0, 0, 0.32], fov: 38 },
  };
}

export function handX(L: Layout, hand: number, handCount: number) {
  if (handCount <= 1) return 0;
  // keep four split hands clear of the AI seats
  const spacing = L.handSpacing * (handCount >= 4 ? 0.72 : handCount >= 3 ? 0.86 : 1);
  return (hand - (handCount - 1) / 2) * spacing;
}

function jitter(id: number) {
  const s = Math.sin(id * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Final position of a card and its rotation around Y. */
export function cardSlot(
  L: Layout,
  to: 'player' | 'dealer' | 'seat',
  hand: number,
  index: number,
  handCount: number,
  cardsInHand: number,
  id: number
): { pos: Vec3; yaw: number; scale?: number } {
  const y = 0.006 + index * 0.0032;
  if (to === 'seat') {
    // `hand` carries the seat side (1 or −1)
    const sp = seatSpot(L, hand as 1 | -1);
    // long hands squeeze together instead of spilling into the player's spot
    const step = Math.min(L.fan * 0.8, 0.9 / Math.max(1, cardsInHand - 1));
    const off = (index - (cardsInHand - 1) / 2) * step * sp.scale;
    const c = Math.cos(sp.yaw);
    const sn = Math.sin(sp.yaw);
    return {
      pos: [sp.cards[0] + off * c, y, sp.cards[2] - off * sn - index * 0.04 * sp.scale],
      yaw: sp.yaw + jitter(id) * 0.05,
      scale: sp.scale,
    };
  }
  if (to === 'dealer') {
    const x = (index - (cardsInHand - 1) / 2) * dealerStep(L, cardsInHand);
    return { pos: [x, y, L.dealerZ], yaw: jitter(id) * 0.025 };
  }
  // cap the spread of a long hand so it stays clear of the AI seats and other split hands
  const span = handCount > 1 ? L.handSpacing * (handCount >= 4 ? 0.72 : handCount >= 3 ? 0.86 : 1) * 0.7 : L.portrait ? 1.0 : 1.8;
  const fan = Math.min(handCount >= 3 ? L.fan * 0.75 : L.fan, span / Math.max(1, cardsInHand - 1));
  const x = handX(L, hand, handCount) + (index - (cardsInHand - 1) / 2) * fan;
  const z = L.playerZ - index * 0.05;
  return { pos: [x, y, z], yaw: jitter(id) * 0.05 };
}

/** Gap between dealer cards; a long dealer hand overlaps more so it stays on screen. */
function dealerStep(L: Layout, cards: number) {
  return Math.min(L.dealerGap, (L.portrait ? 1.2 : 2.6) / Math.max(1, cards - 1));
}

/** Dealer: left of the dealer's cards. Player: just above the hand (dealer side). */
export function handLabelAnchor(L: Layout, to: 'player' | 'dealer', hand: number, handCount: number, cards = 2): Vec3 {
  if (to === 'dealer') return [-((cards - 1) * dealerStep(L, cards)) / 2 - CARD.w / 2 - 0.42, 0.02, L.dealerZ];
  return [handX(L, hand, handCount), 0.02, L.playerZ - CARD.h / 2 - 0.2];
}

/** AI seat at first base (side 1, your right) or third base (side −1). */
export function seatSpot(L: Layout, side: 1 | -1): { cards: Vec3; bet: Vec3; label: Vec3; yaw: number; scale: number } {
  if (L.portrait) {
    // narrow screens: smaller cards pulled in, label under the cards so it clears the dealer's
    return { cards: [side * 1.0, 0, 0.08], bet: [side * 1.06, 0, 0.86], label: [side * 1.0, 0.02, 0.5], yaw: side * 0.22, scale: 0.72 };
  }
  return { cards: [side * 1.94, 0, 0.24], bet: [side * 1.9, 0, 0.98], label: [side * 1.94, 0.02, -0.4], yaw: side * 0.38, scale: 1 };
}

export function betSpot(L: Layout, hand: number, handCount: number): Vec3 {
  return [handX(L, hand, handCount), 0, TABLE.betZ];
}

/** Shoe mouth, where cards come out. */
export function shoeMouth(L: Layout): Vec3 {
  return [L.shoe[0] - 0.32, 0.24, L.shoe[2] + 0.18];
}
