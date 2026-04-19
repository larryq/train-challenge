import * as THREE from "three";

// noise constants -- must match shader values exactly
export const TERRAIN_SCALE = 0.05;
export const MAX_DISPLACEMENT = 1.5;
export const TRACK_FLAT_INNER = 5.0; // fully flat within this distance
export const TRACK_FLAT_OUTER = 20.0; // full displacement beyond this

// simplex-style hash -- matches shader implementation
function hash(x: number, y: number): number {
  let h = x * 127.1 + y * 311.7;
  h = Math.sin(h) * 43758.5453123;
  return h - Math.floor(h);
}

// smooth noise -- bilinear interpolation between hashed corners
function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // smoothstep
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (b - a + a - b + d - c) * ux * uy; // bilinear mix
}

// fractal brownian motion -- 5 octaves
function fbm(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;

  for (let i = 0; i < 5; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }

  return value;
}

// main height query -- called during chunk build for POI placement
export function getTerrainHeight(worldX: number, worldZ: number): number {
  const distFromCenter = Math.abs(worldX);

  // blend factor -- 0 near track, 1 in open terrain
  const trackBlend = THREE.MathUtils.smoothstep(
    distFromCenter,
    TRACK_FLAT_INNER,
    TRACK_FLAT_OUTER,
  );

  if (trackBlend <= 0) return 0;

  const noiseVal = fbm(worldX * TERRAIN_SCALE, worldZ * TERRAIN_SCALE);
  return noiseVal * MAX_DISPLACEMENT * trackBlend;
}

// batch height queries for grass placement -- simplified single octave
export function getTerrainHeightFast(worldX: number, worldZ: number): number {
  const distFromCenter = Math.abs(worldX);
  const trackBlend = THREE.MathUtils.smoothstep(
    distFromCenter,
    TRACK_FLAT_INNER,
    TRACK_FLAT_OUTER,
  );
  if (trackBlend <= 0) return 0;

  // single octave -- fast, good enough for grass
  return (
    noise2D(worldX * TERRAIN_SCALE, worldZ * TERRAIN_SCALE) *
    MAX_DISPLACEMENT *
    trackBlend
  );
}
