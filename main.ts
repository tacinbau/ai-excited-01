// Lanternback: The Village That Rides the Dawn Whale
// ai-excited-01 — round 3, from-scratch rebuild.
// A dependency-free procedural painter (Node standard library only).
// It draws the whole scene pixel by pixel into an RGB buffer and encodes
// a PNG by hand (zlib deflate + CRC32 written out explicitly), so the
// entry is fully deterministic: same bytes on every run, no network,
// no randomness beyond a fixed-seed generator, no clock, no file reads.
//
// The scene: at first light a great whale crests a glowing sea carrying
// a tiny lantern-lit village on its back, while paper lanterns rise
// from its rooftops into a dawn sky. One look should land as a jolt:
// impossible scale, warm light against deep blue, everything moving
// toward the sun.
//
// Run it with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const HORIZON = 648; // where the sea meets the sky
const SUN_X = 300;
const SUN_Y = 470;
const SUN_R = 85;

// ---------------------------------------------------------------------------
// Deterministic randomness: one fixed seed, mulberry32. Every star, wave
// and lantern is placed by this generator, so the picture never changes.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261116);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smooth(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Pixel buffer: 3 bytes per pixel, row-major. `set` blends a colour over
// whatever is already there at the given opacity.
// ---------------------------------------------------------------------------
const buf = new Uint8Array(W * H * 3);

function setPx(x, y, r, g, b, alpha) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (alpha <= 0) return;
  const i = (y * W + x) * 3;
  if (alpha >= 1) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    return;
  }
  buf[i] = Math.round(buf[i] * (1 - alpha) + r * alpha);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - alpha) + g * alpha);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - alpha) + b * alpha);
}

function mix3(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---------------------------------------------------------------------------
// 1. Dawn sky: a vertical gradient through five stops, indigo at the top
//    melting into ember orange at the horizon. Painted row by row.
// ---------------------------------------------------------------------------
const SKY_STOPS = [
  [0.0, [14, 9, 46]],
  [0.28, [52, 22, 92]],
  [0.52, [122, 42, 108]],
  [0.74, [214, 86, 84]],
  [1.0, [255, 164, 86]],
];

function skyColorAt(y) {
  const t = clamp(y / HORIZON, 0, 1);
  for (let s = 0; s < SKY_STOPS.length - 1; s++) {
    const [t0, c0] = SKY_STOPS[s];
    const [t1, c1] = SKY_STOPS[s + 1];
    if (t >= t0 && t <= t1) return mix3(c0, c1, (t - t0) / (t1 - t0));
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

for (let y = 0; y < HORIZON; y++) {
  const [r, g, b] = skyColorAt(y);
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
  }
}

// ---------------------------------------------------------------------------
// 2. Stars: only in the upper sky, fading out as the dawn brightens.
//    Each star is a small cross of light so the sky feels alive, not flat.
// ---------------------------------------------------------------------------
for (let n = 0; n < 240; n++) {
  const x = Math.floor(rand() * W);
  const y = Math.floor(rand() * rand() * 420); // denser toward the top
  const fade = 1 - y / 460;
  const bright = (0.35 + rand() * 0.65) * fade;
  const size = rand() < 0.12 ? 2 : 1;
  const warm = rand() < 0.3;
  const r = warm ? 255 : 225;
  const g = warm ? 226 : 235;
  const b = warm ? 190 : 255;
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d <= size) setPx(x + dx, y + dy, r, g, b, bright * (1 - d / (size + 1)) * 0.9);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The sun: a wide warm halo first (so the glow feels like light in
//    the air), then the disc itself, brightest at its heart.
// ---------------------------------------------------------------------------
function radialGlow(cx, cy, radius, r, g, b, strength) {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(W - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(H - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      const fall = Math.pow(1 - d, 2.2) * strength;
      setPx(x, y, r, g, b, fall);
    }
  }
}

radialGlow(SUN_X, SUN_Y, 340, 255, 122, 48, 0.55);
radialGlow(SUN_X, SUN_Y, 190, 255, 176, 92, 0.7);

for (let y = SUN_Y - SUN_R; y <= SUN_Y + SUN_R; y++) {
  for (let x = SUN_X - SUN_R; x <= SUN_X + SUN_R; x++) {
    const d = Math.hypot(x - SUN_X, y - SUN_Y) / SUN_R;
    if (d > 1) continue;
    const core = 1 - smooth(d);
    const r = lerp(255, 255, core);
    const g = lerp(150, 244, core);
    const b = lerp(64, 214, core);
    setPx(x, y, r, g, b, 1);
  }
}

// A thin bright ring where the sun kisses the horizon line.
for (let x = 0; x < W; x++) {
  const d = Math.abs(x - SUN_X);
  const a = Math.max(0, 1 - d / 300) * 0.5;
  setPx(x, HORIZON - 1, 255, 200, 120, a);
  setPx(x, HORIZON - 2, 255, 190, 110, a * 0.6);
}

// ---------------------------------------------------------------------------
// 4. Clouds: long soft ellipses, lit from below by the sun, drifting
//    across the sky in three bands. Each cloud is many overlapping
//    translucent puffs, so the edges stay feathery.
// ---------------------------------------------------------------------------
function puff(cx, cy, rx, ry, r, g, b, alpha) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      setPx(x, y, r, g, b, alpha * (1 - d * d));
    }
  }
}

function cloudBand(cy, count, lit) {
  for (let n = 0; n < count; n++) {
    const cx = rand() * W;
    const spread = 60 + rand() * 130;
    const puffs = 4 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const px = cx + (rand() - 0.5) * spread;
      const py = cy + (rand() - 0.5) * 16;
      const rx = 26 + rand() * 42;
      const ry = 7 + rand() * 9;
      // Lit from below: warm near the sun, violet higher up.
      const warmth = lit ? 0.75 : 0.35;
      const r = lerp(96, 255, warmth);
      const g = lerp(70, 158, warmth);
      const b = lerp(128, 116, warmth);
      puff(px, py, rx, ry, r, g, b, 0.16 + rand() * 0.1);
    }
  }
}

cloudBand(150, 5, false);
cloudBand(300, 7, true);
cloudBand(470, 6, true);

// ---------------------------------------------------------------------------
// 5. The sea: deep teal-violet below the horizon, darkening with depth,
//    with long horizontal wave strokes and a glittering path of sunlight
//    running from the horizon straight toward the viewer.
// ---------------------------------------------------------------------------
const SEA_STOPS = [
  [0.0, [74, 52, 104]],
  [0.35, [32, 44, 92]],
  [1.0, [10, 16, 48]],
];
for (let y = HORIZON; y < H; y++) {
  const t = (y - HORIZON) / (H - HORIZON);
  let c = SEA_STOPS[SEA_STOPS.length - 1][1];
  for (let s = 0; s < SEA_STOPS.length - 1; s++) {
    const [t0, c0] = SEA_STOPS[s];
    const [t1, c1] = SEA_STOPS[s + 1];
    if (t >= t0 && t <= t1) {
      c = mix3(c0, c1, (t - t0) / (t1 - t0));
      break;
    }
  }
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
  }
}

// Sun glitter: a widening column of bright dashes on the water.
for (let n = 0; n < 420; n++) {
  const t = rand();
  const y = HORIZON + 6 + t * (H - HORIZON - 14);
  const halfWidth = 26 + t * 150;
  const x = SUN_X + (rand() - 0.5) * 2 * halfWidth;
  const len = 6 + rand() * 22;
  const bright = (1 - t * 0.45) * (0.35 + rand() * 0.55);
  for (let dx = 0; dx < len; dx++) {
    setPx(Math.floor(x) + dx, Math.floor(y), 255, 196, 110, bright);
  }
}

// Long wave strokes: darker troughs and pale crests, gently wavy.
for (let n = 0; n < 90; n++) {
  const y = HORIZON + 12 + rand() * (H - HORIZON - 24);
  const x = rand() * W;
  const len = 40 + rand() * 160;
  const crest = rand() < 0.5;
  const a = 0.1 + rand() * 0.16;
  for (let dx = 0; dx < len; dx++) {
    const wobble = Math.round(Math.sin((dx / len) * Math.PI * 2 + n) * 2);
    if (crest) setPx(Math.floor(x) + dx, Math.floor(y) + wobble, 150, 190, 220, a);
    else setPx(Math.floor(x) + dx, Math.floor(y) + wobble, 6, 10, 34, a);
  }
}

// ---------------------------------------------------------------------------
// 6. The whale. Built from overlapping ellipses so its silhouette stays
//    smooth: a great arched body, a rounded head to the right, a tapering
//    tail to the left, and twin flukes thrown up into the sky. A pale
//    belly, a warm rim of dawn light along its back, a calm eye, and a
//    spout of glowing droplets complete it.
// ---------------------------------------------------------------------------
function ellipse(cx, cy, rx, ry, r, g, b, alpha) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d < 1) setPx(x, y, r, g, b, alpha);
    }
  }
}

function triangle(x1, y1, x2, y2, x3, y3, r, g, b, alpha) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x1, x2, x3)));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y1, y2, y3)));
  const den = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  if (den === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w1 = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / den;
      const w2 = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / den;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) setPx(x, y, r, g, b, alpha);
    }
  }
}

const WHALE = [22, 50, 74]; // deep slate blue
const WHALE_DARK = [13, 32, 52];
const WHALE_BELLY = [126, 178, 198];

// Flukes first (behind the body), thrown high to the left — wide
// triangles with rounded tips that overlap the body, so they read as
// one tail instead of loose blobs.
triangle(226, 508, 104, 384, 196, 452, ...WHALE, 1);
triangle(226, 508, 132, 424, 262, 466, ...WHALE, 1);
ellipse(118, 392, 34, 15, ...WHALE, 1);
ellipse(146, 432, 30, 13, ...WHALE, 1);

// Tail stock, body, head.
ellipse(268, 520, 130, 52, ...WHALE, 1);
ellipse(512, 552, 372, 128, ...WHALE, 1);
ellipse(742, 536, 168, 112, ...WHALE, 1);
// A darker shade low on the body gives it roundness.
ellipse(512, 596, 340, 96, ...WHALE_DARK, 0.55);
// Pale belly catching the dawn — kept modest so the body stays deep blue.
ellipse(560, 612, 290, 50, ...WHALE_BELLY, 0.7);
ellipse(700, 598, 150, 38, ...WHALE_BELLY, 0.5);

// Rim light: a warm line hugging the top of the back, brightest
// nearest the sun.
for (let x = 170; x <= 880; x++) {
  const t = (x - 170) / 710;
  // The back's curve: high in the middle, dipping toward head and tail.
  const backY = 552 - 128 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 512) / 372, 2)));
  const warmth = 1 - Math.abs(x - SUN_X) / 520;
  for (let dy = 0; dy < 5; dy++) {
    setPx(x, Math.round(backY) + dy, 255, 176, 104, (0.85 - dy * 0.16) * (0.45 + 0.55 * warmth));
  }
}

// Pectoral fin, swept down into the water — same blue as the body and
// tucked at the belly's edge, so it reads as a fin and not a loose wedge.
triangle(600, 636, 656, 688, 706, 648, ...WHALE, 1);
ellipse(660, 672, 26, 12, ...WHALE, 1);

// The eye: calm, dark, with a pinpoint of dawn reflected in it.
ellipse(758, 516, 13, 13, 8, 12, 24, 1);
ellipse(762, 512, 4, 4, 255, 220, 160, 1);
// A gentle mouth line curving back from the head.
for (let t = 0; t <= 1; t += 0.02) {
  const x = 700 + t * 150;
  const y = 566 + Math.sin(t * Math.PI) * 10 + t * 6;
  setPx(Math.round(x), Math.round(y), 10, 24, 40, 0.8);
  setPx(Math.round(x), Math.round(y) + 1, 10, 24, 40, 0.5);
}

// Spout: a fountain of glowing droplets bursting from the blowhole,
// arcing up and out over the village.
for (let n = 0; n < 90; n++) {
  const t = rand();
  const ang = -Math.PI / 2 + (rand() - 0.5) * 1.5;
  const dist = 26 + t * 130;
  const x = 640 + Math.cos(ang) * dist + (rand() - 0.5) * 14;
  const y = 442 - Math.sin(Math.abs(ang) + 0.4) * dist * 0.7 - t * 40;
  const size = rand() < 0.2 ? 3 : rand() < 0.5 ? 2 : 1;
  const bright = 0.5 + rand() * 0.5;
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      if (Math.hypot(dx, dy) <= size) {
        setPx(Math.round(x) + dx, Math.round(y) + dy, 190, 225, 245, bright * 0.85);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. The village on the whale's back. Nine little houses follow the curve
//    of the spine, each with a warm lit window, a pitched roof, and a
//    chimney breathing a wisp of smoke. A tiny lighthouse stands at the
//    head end, sweeping a beam across the dawn.
// ---------------------------------------------------------------------------
function backYAt(x) {
  const t = clamp((x - 512) / 372, -1, 1);
  return 552 - 128 * Math.sqrt(Math.max(0, 1 - t * t));
}

const ROOFS = [
  [255, 122, 77],
  [201, 79, 94],
  [255, 150, 64],
  [178, 84, 120],
];
const WALLS = [
  [52, 34, 66],
  [66, 40, 72],
  [44, 44, 80],
];

function house(x, w, h, roofColor, wallColor) {
  const baseY = Math.round(backYAt(x)) - 4;
  // Walls.
  for (let y = baseY - h; y <= baseY; y++) {
    for (let px = x - w / 2; px <= x + w / 2; px++) {
      setPx(Math.round(px), y, ...wallColor, 1);
    }
  }
  // Pitched roof.
  triangle(
    x - w / 2 - 5, baseY - h,
    x + w / 2 + 5, baseY - h,
    x, baseY - h - 16 - Math.floor(rand() * 6),
    ...roofColor, 1,
  );
  // Two warm windows.
  for (const wx of [-w / 5, w / 5]) {
    for (let wy = 0; wy < 7; wy++) {
      for (let wx2 = 0; wx2 < 6; wx2++) {
        setPx(Math.round(x + wx + wx2 - 3), baseY - h + 8 + wy, 255, 205, 110, 1);
      }
    }
  }
  // Door, lit from inside.
  for (let dy = 0; dy < 10; dy++) {
    for (let dx = 0; dx < 6; dx++) {
      setPx(Math.round(x) + dx - 3, baseY - 9 + dy, 255, 186, 92, 1);
    }
  }
  // Chimney with a curl of smoke.
  const chX = Math.round(x + w / 3);
  for (let cy = baseY - h - 18; cy <= baseY - h - 8; cy++) {
    setPx(chX, cy, 40, 26, 52, 1);
    setPx(chX + 1, cy, 40, 26, 52, 1);
  }
  let sx = chX;
  let sy = baseY - h - 20;
  for (let s = 0; s < 7; s++) {
    sx += Math.round((rand() - 0.3) * 6);
    sy -= 5;
    ellipse(sx, sy, 4, 3, 220, 210, 225, 0.35);
  }
}

const HOUSE_SPOTS = [236, 306, 372, 442, 512, 584, 656, 724, 796];
HOUSE_SPOTS.forEach((x, i) => {
  const w = 34 + Math.floor(rand() * 14);
  const h = 30 + Math.floor(rand() * 12);
  house(x, w, h, ROOFS[i % ROOFS.length], WALLS[i % WALLS.length]);
});

// Little pine trees between the houses.
for (const tx of [272, 408, 548, 690]) {
  const baseY = Math.round(backYAt(tx)) - 4;
  triangle(tx - 9, baseY, tx + 9, baseY, tx, baseY - 26, 26, 84, 58, 1);
  triangle(tx - 7, baseY - 12, tx + 7, baseY - 12, tx, baseY - 34, 34, 102, 70, 1);
  setPx(tx, baseY - 1, 90, 60, 40, 1);
  setPx(tx, baseY - 2, 90, 60, 40, 1);
}

// Lighthouse at the head end, on the highest part of the back.
(function lighthouse() {
  const x = 830;
  const baseY = Math.round(backYAt(830)) - 4;
  for (let y = baseY - 64; y <= baseY; y++) {
    const half = 7 - ((y - (baseY - 64)) / 64) * 2;
    for (let px = x - half; px <= x + half; px++) {
      const stripe = Math.floor((baseY - y) / 10) % 2 === 0;
      setPx(Math.round(px), y, ...(stripe ? [240, 236, 228] : [214, 74, 80]), 1);
    }
  }
  // Lamp room, glowing.
  for (let y = baseY - 76; y <= baseY - 64; y++) {
    for (let px = x - 9; px <= x + 9; px++) {
      setPx(px, y, 255, 214, 130, 1);
    }
  }
  radialGlow(x, baseY - 70, 42, 255, 200, 100, 0.6);
  // Roof cap.
  triangle(x - 11, baseY - 76, x + 11, baseY - 76, x, baseY - 88, 40, 26, 52, 1);
  // Beam sweeping left across the sky.
  for (let d = 0; d < 260; d++) {
    const bx = x - 10 - d;
    const by = baseY - 70 - Math.round(d * 0.12);
    const spread = 2 + d * 0.03;
    for (let s = -spread; s <= spread; s++) {
      setPx(Math.round(bx), Math.round(by + s), 255, 222, 150, 0.22 * (1 - d / 280));
    }
  }
})();

// Strings of tiny lanterns draped between the rooftops.
for (let s = 0; s < HOUSE_SPOTS.length - 1; s++) {
  const x1 = HOUSE_SPOTS[s];
  const x2 = HOUSE_SPOTS[s + 1];
  const y1 = Math.round(backYAt(x1)) - 34;
  const y2 = Math.round(backYAt(x2)) - 34;
  for (let t = 0.1; t < 0.95; t += 0.14) {
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t) + Math.sin(t * Math.PI) * 10;
    radialGlow(Math.round(x), Math.round(y), 9, 255, 170, 80, 0.5);
    ellipse(Math.round(x), Math.round(y), 3, 4, 255, 190, 90, 1);
  }
}

// ---------------------------------------------------------------------------
// 8. Paper lanterns rising: warm orbs with a bright heart and a soft halo,
//    drifting up from the village into the sky. The higher they go the
//    smaller and fainter they get, so the eye follows them upward.
// ---------------------------------------------------------------------------
for (let n = 0; n < 46; n++) {
  const t = rand(); // 0 = just launched, 1 = high in the sky
  const x = 180 + rand() * 660 + (rand() - 0.5) * 60 * t;
  const y = 430 - t * 330 + (rand() - 0.5) * 24;
  const size = Math.round(lerp(9, 3, t));
  const alpha = lerp(1, 0.75, t);
  radialGlow(Math.round(x), Math.round(y), size * 4, 255, 150, 60, 0.5 * alpha);
  ellipse(Math.round(x), Math.round(y), size, size + 2, 255, 176, 84, alpha);
  ellipse(Math.round(x), Math.round(y) - 1, Math.max(1, size - 3), Math.max(1, size - 2), 255, 236, 170, alpha);
  // A short tassel string below each lantern.
  for (let d = 1; d <= size + 3; d++) {
    setPx(Math.round(x), Math.round(y) + size + d, 255, 200, 120, 0.7 * alpha);
  }
}

// ---------------------------------------------------------------------------
// 9. Birds: small dark chevrons high in the sky, heading toward the sun.
// ---------------------------------------------------------------------------
for (let n = 0; n < 14; n++) {
  const x = 120 + rand() * 780;
  const y = 90 + rand() * 220;
  const s = 4 + Math.floor(rand() * 5);
  for (let d = 0; d <= s; d++) {
    setPx(Math.round(x - d), Math.round(y - d * 0.5), 24, 16, 44, 0.9);
    setPx(Math.round(x + d), Math.round(y - d * 0.5), 24, 16, 44, 0.9);
  }
}

// One shooting star, streaking down toward the sunrise — a last spark of
// night giving way to morning, and a diagonal that pulls the eye to the sun.
(function shootingStar() {
  const x0 = 830;
  const y0 = 96;
  for (let d = 0; d < 64; d++) {
    const x = x0 - d;
    const y = y0 + Math.round(d * 0.42);
    const fade = 1 - d / 64;
    setPx(x, y, 255, 244, 214, 0.95 * fade);
    setPx(x, y + 1, 255, 220, 170, 0.5 * fade);
  }
  radialGlow(x0, y0, 10, 255, 240, 200, 0.8);
})();

// ---------------------------------------------------------------------------
// 10. The whale's reflection: a dark, wavy echo of the body in the water
//     below, smeared sideways so it reads as a reflection, not a copy.
// ---------------------------------------------------------------------------
for (let y = HORIZON; y < HORIZON + 150; y++) {
  const depth = (y - HORIZON) / 150;
  const wobble = Math.sin(y * 0.35) * 6 + Math.sin(y * 0.11) * 10;
  for (let x = 170; x <= 880; x++) {
    const srcX = Math.round(x + wobble);
    const srcY = Math.round(552 + (y - HORIZON) * 0.9);
    if (srcY < 0 || srcY >= HORIZON) continue;
    const si = (srcY * W + srcX) * 3;
    const isWhale = buf[si] === WHALE[0] && buf[si + 1] === WHALE[1] && buf[si + 2] === WHALE[2];
    if (isWhale) {
      setPx(x, y, 16, 34, 58, 0.4 * (1 - depth));
    }
  }
}

// ---------------------------------------------------------------------------
// 11. Finishing: a gentle vignette to pull the eye to the centre, and a
//     whisper of warm light low over the water.
// ---------------------------------------------------------------------------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2);
    const dy = (y - H / 2) / (H / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    const vig = smooth((d - 0.72) / 0.55) * 0.22;
    if (vig > 0) setPx(x, y, 8, 6, 24, vig);
  }
}

// ---------------------------------------------------------------------------
// 12. Minimal PNG encoder: raw scanlines (filter 0), one IDAT of
//     zlib-deflated data, CRC32 per chunk. No dependencies, no surprises.
// ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    // Uint8Array has no .copy — use .set with the row's subarray instead.
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Write the entry. The grader reads /output/entry.png; outside its
// container MAKEFUN_OUTPUT_DIR stands in for /output.
// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePng();
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes, ${W}x${H})`);
