import * as THREE from "three";
import type { ExclusionZone } from "./placementUtils";
import { isExcluded } from "./placementUtils";
// @ts-expect-error expect a complaint in shader include
import waterVert from "../shaders/water.vert.glsl";
// @ts-expect-error expect a complaint in shader include
import waterFrag from "../shaders/water.frag.glsl";

// ---- config -----------------------------------------------

export const LANDMARK_CONFIG = {
  LAKE_PROBABILITY: 0.95,
  FIELD_PROBABILITY: 0.92,

  // lake
  LAKE_RADIUS_MIN: 12,
  LAKE_RADIUS_MAX: 28,
  LAKE_WATER_COLOR: "#4a9aba",
  LAKE_SHORE_COLOR: "#ba894a",
  LAKE_SHORE_WIDTH: 2,
  LAKE_OPACITY: 0.85,
  LAKE_TRACK_CLEAR: 20,
  LAKE_FADE_DURATION: 2500,
  LAKE_GROW_DURATION: 2000,
  LAKE_WAVE_STRENGTH: 0.08, // increase for more obvious waves
  LAKE_WAVE_SPEED: 0.7, // increase for faster movement
  LAKE_WAVE_SCALE: 0.3, // increase for tighter ripples
  LAKE_DEEP_COLOR: "#0d3d5c",
  LAKE_SHALLOW_COLOR: "#4a9aba",

  // field
  FIELD_SIZE_MIN: 20,
  FIELD_SIZE_MAX: 35,
  FIELD_TRACK_CLEAR: 25,
  FIELD_FADE_DURATION: 1500,
  FIELD_Y_OFFSET: 0.12, // float above terrain
  FIELD_COLOR_GOLDEN: "#c8a832",
  FIELD_COLOR_GREEN: "#4a7a2a",
  FIELD_COLOR_BROWN: "#6a4a1a",
  FIELD_COLOR_BORDER: "#2a1a0a",
} as const;

// ---- lake geometry ----------------------------------------

export function createLakeGeometry(
  radius: number,
  seed: number,
): THREE.BufferGeometry {
  const segments = 48;

  let s = seed * 7331 + 19937;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // generate perimeter points with two octaves of noise
  const points: THREE.Vector2[] = [];

  // compute once outside the loop -- seed-based phase offsets
  const seedAngle = seed * 0.001;
  //const largeLobes = 3; // fixed lobe count -- more consistent shape
  const largeLobes = 3 + (seed % 3); // gives 3, 4, or 5 based on seed
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    // continuous sine waves keyed to angle -- smooth transitions between vertices
    const largeNoise =
      Math.sin(angle * largeLobes + seedAngle) * 0.2 +
      Math.sin(angle * (largeLobes + 2) + seedAngle * 1.3) * 0.1;

    // fine detail -- also continuous
    const smallNoise =
      Math.sin(angle * 8 + seedAngle * 2.1) * 0.06 +
      Math.sin(angle * 11 + seedAngle * 0.7) * 0.04;

    const r = radius * (1 + largeNoise + smallNoise);
    points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
  }

  // build geometry using fan triangulation from center
  const vertices: number[] = [];
  const indices: number[] = [];

  // center vertex
  vertices.push(0, 0, 0);

  // perimeter vertices
  for (const p of points) {
    vertices.push(p.x, 0, p.y);
  }

  // fan triangles
  for (let i = 1; i <= segments; i++) {
    const next = (i % segments) + 1;
    indices.push(0, i, next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

export function createShoreGeometry(
  radius: number,
  shoreWidth: number,
  seed: number,
): THREE.BufferGeometry {
  // shore is a slightly larger version of the lake
  // using the same seed so it matches the lake shape
  return createLakeGeometry(radius + shoreWidth, seed);
}

// ---- field geometry ---------------------------------------

export function createFieldGeometry(
  size: number,
  seed: number,
): THREE.BufferGeometry {
  const subdivisions = 4; // 4x4 = 16 cells

  let s = seed * 3571 + 7919;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const geo = new THREE.PlaneGeometry(size, size, subdivisions, subdivisions);
  geo.rotateX(-Math.PI / 2);

  // assign vertex colors per cell
  const posAttr = geo.attributes.position;
  const vertCount = posAttr.count;
  const colors = new Float32Array(vertCount * 3);

  // determine cell colors -- seeded pattern
  const cellColors: THREE.Color[] = [];
  for (let row = 0; row < subdivisions; row++) {
    for (let col = 0; col < subdivisions; col++) {
      const r = rng();
      let color: THREE.Color;
      if (r < 0.55) {
        // golden -- corn
        color = new THREE.Color(LANDMARK_CONFIG.FIELD_COLOR_GOLDEN);
        // slight variation
        color.r += (rng() - 0.5) * 0.1;
        color.g += (rng() - 0.5) * 0.08;
      } else if (r < 0.85) {
        // green -- vegetables
        color = new THREE.Color(LANDMARK_CONFIG.FIELD_COLOR_GREEN);
        color.g += (rng() - 0.5) * 0.1;
      } else {
        // brown -- fallow
        color = new THREE.Color(LANDMARK_CONFIG.FIELD_COLOR_BROWN);
        color.r += (rng() - 0.5) * 0.06;
      }
      cellColors.push(color);
    }
  }

  // assign colors to vertices based on cell
  // PlaneGeometry vertices go row by row
  const vertsPerRow = subdivisions + 1;

  for (let row = 0; row <= subdivisions; row++) {
    for (let col = 0; col <= subdivisions; col++) {
      const vertIndex = row * vertsPerRow + col;

      // pick cell -- clamp to valid range
      const cellRow = Math.min(row, subdivisions - 1);
      const cellCol = Math.min(col, subdivisions - 1);
      const cellIndex = cellRow * subdivisions + cellCol;

      const color = cellColors[cellIndex];
      colors[vertIndex * 3] = color.r;
      colors[vertIndex * 3 + 1] = color.g;
      colors[vertIndex * 3 + 2] = color.b;
    }
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  return geo;
}

// ---- placement --------------------------------------------

export interface LakeConfig {
  position: THREE.Vector3;
  radius: number;
  seed: number;
}

export interface FieldConfig {
  position: THREE.Vector3;
  size: number;
  rotation: number; // Y axis rotation
  seed: number;
}

export function placeLandmarks(
  chunkId: number,
  worldPoints: THREE.Vector3[],
  exclusionZones: ExclusionZone[],
): { lakes: LakeConfig[]; fields: FieldConfig[] } {
  console.log(
    `placeLandmarks chunk ${chunkId}: exclusionZones=${exclusionZones.length}`,
  );
  const lakes: LakeConfig[] = [];
  const fields: FieldConfig[] = [];

  let s = chunkId * 4513 + 28657;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // pick a random point along the chunk spline
  const pickSplinePoint = () => {
    const idx = Math.floor(rng() * (worldPoints.length - 2));
    const pos = worldPoints[idx].clone();
    const next = worldPoints[Math.min(idx + 1, worldPoints.length - 1)];
    const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    return { pos, right };
  };

  // attempt lake placement
  if (rng() < LANDMARK_CONFIG.LAKE_PROBABILITY) {
    let placed = false;
    for (let attempt = 0; attempt < 8 && !placed; attempt++) {
      const { pos, right } = pickSplinePoint();

      const side = rng() > 0.5 ? 1 : -1;
      const lateral = LANDMARK_CONFIG.LAKE_TRACK_CLEAR + rng() * 30;
      const radius =
        LANDMARK_CONFIG.LAKE_RADIUS_MIN +
        rng() *
          (LANDMARK_CONFIG.LAKE_RADIUS_MAX - LANDMARK_CONFIG.LAKE_RADIUS_MIN);

      const lakePos = pos.clone().addScaledVector(right, side * lateral);
      lakePos.y = 0;

      const excluded = isExcluded(lakePos, exclusionZones, radius * 0.5);

      if (excluded) continue;

      // register lake in exclusion zones
      exclusionZones.push({
        position: lakePos.clone(),
        radius: radius + LANDMARK_CONFIG.LAKE_SHORE_WIDTH + 5,
        type: "poi",
      });

      lakes.push({
        position: lakePos,
        radius,
        seed: Math.floor(rng() * 100000),
      });

      placed = true;
    }
  }

  // attempt field placement
  if (rng() < LANDMARK_CONFIG.FIELD_PROBABILITY) {
    let placed = false;
    for (let attempt = 0; attempt < 8 && !placed; attempt++) {
      const { pos, right } = pickSplinePoint();

      const side = rng() > 0.5 ? 1 : -1;
      const lateral = LANDMARK_CONFIG.FIELD_TRACK_CLEAR + rng() * 20;
      const size =
        LANDMARK_CONFIG.FIELD_SIZE_MIN +
        rng() *
          (LANDMARK_CONFIG.FIELD_SIZE_MAX - LANDMARK_CONFIG.FIELD_SIZE_MIN);

      const fieldPos = pos.clone().addScaledVector(right, side * lateral);
      fieldPos.y = LANDMARK_CONFIG.FIELD_Y_OFFSET;

      if (isExcluded(fieldPos, exclusionZones, size * 0.6)) continue;

      exclusionZones.push({
        position: fieldPos.clone(),
        radius: size * 0.7,
        type: "poi",
      });

      fields.push({
        position: fieldPos,
        size,
        rotation: rng() * Math.PI * 2,
        seed: Math.floor(rng() * 100000),
      });

      placed = true;
    }
  }

  return { lakes, fields };
}

export function createWaterMaterial(
  config: LakeConfig,
  landmarkConfig: typeof LANDMARK_CONFIG,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      // existing uniforms
      uTime: { value: 0 },
      uLakeCenter: { value: config.position.clone() },
      uLakeRadius: { value: config.radius },
      uOpacity: { value: 0 },
      uWaveStrength: { value: landmarkConfig.LAKE_WAVE_STRENGTH },
      uWaveSpeed: { value: landmarkConfig.LAKE_WAVE_SPEED },
      uWaveScale: { value: landmarkConfig.LAKE_WAVE_SCALE },
      uDeepColor: { value: new THREE.Color(landmarkConfig.LAKE_DEEP_COLOR) },
      uShallowColor: {
        value: new THREE.Color(landmarkConfig.LAKE_SHALLOW_COLOR),
      },

      // fog uniforms -- required by Three.js fog includes
      fogColor: { value: new THREE.Color("#c8a882") },
      fogDensity: { value: 0.022 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
