/* eslint-disable @typescript-eslint/no-unused-vars */
import * as THREE from "three";
import { type ExclusionZone, isExcluded } from "./placementUtils";

// TESTING ONLY -- set to true to force hills onto track
const FORCE_HILL_INTERSECTIONS = false;

interface HillConfig {
  height: number;
  radius: number;
  radialSegments: number;
  seed: number;
  lean: number; // slight lean angle in radians
  noiseStrength: number;
}

// Approach A -- generates a low-poly cone-shaped hill with noise displacement for a more natural look

export function generateHillGeometry(config: HillConfig): THREE.BufferGeometry {
  const {
    height,
    radius,
    radialSegments = 8,
    seed,
    lean = 0,
    noiseStrength = 0.15,
  } = config;

  // simple seeded random
  let s = seed * 9301 + 49297;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // build vertices -- cone shape with noise displacement
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const heightSegments = 6;

  // apex
  vertices.push(
    Math.sin(lean) * height * 0.3, // slight lean on X
    height,
    0,
  );

  // apex color -- snow white
  colors.push(0.94, 0.96, 0.98);

  // rings of vertices from top to bottom
  for (let h = 0; h < heightSegments; h++) {
    const t = (h + 1) / heightSegments; // 0 = top, 1 = bottom
    const ringY = height * (1 - t);
    const ringRadius = radius * t;

    // color based on height
    const heightFactor = 1 - t; // 1 = top, 0 = bottom
    const col = getHillColor(heightFactor);

    for (let r = 0; r < radialSegments; r++) {
      const angle = (r / radialSegments) * Math.PI * 2;

      // noise displacement -- more at mid heights, less at base and apex
      const noiseMask = Math.sin(t * Math.PI); // peaks at t=0.5
      const noise = (rng() - 0.5) * 2 * noiseStrength * noiseMask;

      const x =
        Math.cos(angle) * ringRadius * (1 + noise) +
        Math.sin(lean) * ringY * 0.3;
      const z = Math.sin(angle) * ringRadius * (1 + noise);

      vertices.push(x, ringY, z);
      colors.push(col.r, col.g, col.b);
    }
  }

  // base center
  vertices.push(0, -0.5, 0);
  colors.push(0.1, 0.22, 0.16); // dark base

  // build indices
  // apex to first ring
  for (let r = 0; r < radialSegments; r++) {
    const next = (r + 1) % radialSegments;
    indices.push(0, 1 + r, 1 + next);
  }

  // ring to ring
  for (let h = 0; h < heightSegments - 1; h++) {
    const ringStart = 1 + h * radialSegments;
    const nextRingStart = 1 + (h + 1) * radialSegments;

    for (let r = 0; r < radialSegments; r++) {
      const next = (r + 1) % radialSegments;

      indices.push(ringStart + r, nextRingStart + r, nextRingStart + next);
      indices.push(ringStart + r, nextRingStart + next, ringStart + next);
    }
  }

  // last ring to base center
  const lastRingStart = 1 + (heightSegments - 1) * radialSegments;
  const baseCenterIndex = vertices.length / 3 - 1;

  for (let r = 0; r < radialSegments; r++) {
    const next = (r + 1) % radialSegments;
    indices.push(lastRingStart + r, baseCenterIndex, lastRingStart + next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

function getHillColor(heightFactor: number): THREE.Color {
  // heightFactor: 1 = peak, 0 = base
  const snow = new THREE.Color("#f0f4f8");
  const lightGrey = new THREE.Color("#8a9aaa");
  const slateGrey = new THREE.Color("#4a5a6a");
  const darkGreen = new THREE.Color("#1a3a2a");

  if (heightFactor > 0.85) {
    return snow.lerp(lightGrey, (1 - heightFactor) / 0.15);
  } else if (heightFactor > 0.6) {
    return lightGrey.lerp(slateGrey, (0.85 - heightFactor) / 0.25);
  } else if (heightFactor > 0.2) {
    return slateGrey.lerp(darkGreen, (0.6 - heightFactor) / 0.4);
  } else {
    return darkGreen;
  }
}

// config for each hill in the ring
export interface HillRingConfig {
  seed: number;
  height: number;
  radius: number;
  lean: number;
  angleOffset: number; // offset from perfect ring position
}

export function generateHillRingConfigs(
  count: number,
  masterSeed: number,
): HillRingConfig[] {
  let s = masterSeed;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  return Array.from({ length: count }, () => ({
    seed: Math.floor(rng() * 100000),
    height: 5 + rng() * 15, // was 30-90, now 20-50 -- shorter
    radius: 35 + rng() * 45, // was 15-40, now 25-60 -- wider
    lean: (rng() - 0.5) * 0.1, // was 0.3, slightly less lean
    angleOffset: (rng() - 0.5) * 0.4,
  }));
}

// ---- nearby hills ----------------------------------------

export interface NearbyHillConfig {
  position: THREE.Vector3; // world space
  height: number;
  radius: number;
  seed: number;
}

function getNearbyHillColor(heightFactor: number): THREE.Color {
  // heightFactor: 1.0 = peak, 0.0 = base
  const darkGreen = new THREE.Color("#1a3d0f"); // very dark green base
  const midGreen = new THREE.Color("#2d6b1a"); // mid green
  const lightGreen = new THREE.Color("#4a8c2a"); // lighter green
  const dryGrass = new THREE.Color("#8a9a3f"); // dry yellowish top

  if (heightFactor > 0.6) {
    // top 40% -- dry grass to light green
    return dryGrass.clone().lerp(lightGreen, (1.0 - heightFactor) / 0.4);
  } else if (heightFactor > 0.3) {
    // middle 30% -- light green to mid green
    return lightGreen.clone().lerp(midGreen, (0.6 - heightFactor) / 0.3);
  } else if (heightFactor > 0.1) {
    // lower 20% -- mid green to dark green
    return midGreen.clone().lerp(darkGreen, (0.3 - heightFactor) / 0.2);
  } else {
    // base 10% -- darkest green
    return darkGreen.clone();
  }
}

export function generateNearbyHillGeometry(
  height: number,
  radius: number,
  seed: number,
): THREE.BufferGeometry {
  const radialSegments = 10;
  const heightSegments = 8;

  let s = seed * 9301 + 49297;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // apex -- rounded top, not sharp point
  // use a small flat cap instead of single vertex
  const capRadius = radius * 0.08;
  vertices.push(0, height, 0);
  const apexColor = getNearbyHillColor(1.0);
  colors.push(apexColor.r, apexColor.g, apexColor.b);

  // rings from top to bottom
  for (let h = 0; h < heightSegments; h++) {
    const t = (h + 1) / heightSegments; // 0 = top, 1 = bottom

    // dome curve -- sin gives rounded top, wider base
    const ringRadius = radius * Math.sin(t * Math.PI * 0.5);
    const ringY = height * (1 - t);

    // color based on height
    const heightFactor = 1 - t;
    const col = getNearbyHillColor(heightFactor);

    for (let r = 0; r < radialSegments; r++) {
      const angle = (r / radialSegments) * Math.PI * 2;

      // gentle noise -- more organic than perfect dome
      // less noise than distant hills since these are close up
      const noiseMask = Math.sin(t * Math.PI) * 0.5;
      const noise = (rng() - 0.5) * 2 * 0.12 * noiseMask;

      const x = Math.cos(angle) * ringRadius * (1 + noise);
      const z = Math.sin(angle) * ringRadius * (1 + noise);

      vertices.push(x, ringY, z);
      colors.push(col.r, col.g, col.b);
    }
  }

  // base center
  vertices.push(0, 0, 0);
  const baseColor = getNearbyHillColor(0);
  colors.push(baseColor.r, baseColor.g, baseColor.b);

  const baseCenterIndex = vertices.length / 3 - 1;

  // apex to first ring
  for (let r = 0; r < radialSegments; r++) {
    const next = (r + 1) % radialSegments;
    indices.push(0, 1 + r, 1 + next);
  }

  // ring to ring
  for (let h = 0; h < heightSegments - 1; h++) {
    const ringStart = 1 + h * radialSegments;
    const nextRingStart = 1 + (h + 1) * radialSegments;

    for (let r = 0; r < radialSegments; r++) {
      const next = (r + 1) % radialSegments;
      indices.push(ringStart + r, nextRingStart + r, nextRingStart + next);
      indices.push(ringStart + r, nextRingStart + next, ringStart + next);
    }
  }

  // last ring to base
  const lastRingStart = 1 + (heightSegments - 1) * radialSegments;
  for (let r = 0; r < radialSegments; r++) {
    const next = (r + 1) % radialSegments;
    indices.push(lastRingStart + r, baseCenterIndex, lastRingStart + next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

// minimum distance between hills to prevent overlap
const MIN_HILL_SPACING = 25;

export function tooCloseToExisting(
  pos: THREE.Vector3,
  existing: THREE.Vector3[],
  minDist: number,
): boolean {
  return existing.some((e) => e.distanceTo(pos) < minDist);
}

export function placeNearbyHills(
  chunkId: number,
  worldPoints: THREE.Vector3[],
  exclusionZones: ExclusionZone[],
  minLateralDist = 60,
  maxLateralDist = 90,
  hillsPerSide = 3,
): NearbyHillConfig[] {
  const configs: NearbyHillConfig[] = [];
  const localZones = [...exclusionZones]; // copy -- we add to it as we place

  let s = chunkId * 9301 + 49297;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (const side of [-1, 1]) {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = hillsPerSide * 8;

    while (placed < hillsPerSide && attempts < maxAttempts) {
      attempts++;

      const pointIndex = Math.floor(rng() * (worldPoints.length - 2));
      const pos = worldPoints[pointIndex].clone();
      const next =
        worldPoints[Math.min(pointIndex + 1, worldPoints.length - 1)].clone();

      const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const lateralDist =
        minLateralDist + rng() * (maxLateralDist - minLateralDist);
      const hillPos = pos.clone().addScaledVector(right, side * lateralDist);
      hillPos.y = 0;

      const hillRadius = 5 + rng() * 8;

      // check against all exclusion zones
      if (isExcluded(hillPos, localZones, hillRadius)) continue;

      // passed -- add to local registry so subsequent hills avoid this one
      localZones.push({
        position: hillPos.clone(),
        radius: hillRadius + 5, // small buffer
        type: "hill_dome",
      });

      configs.push({
        position: hillPos,
        height: 2 + rng() * 6,
        radius: hillRadius,
        seed: Math.floor(rng() * 100000),
      });

      placed++;
    }
  }

  return configs;
}

// ---- spherical hills (Approach B) ------------------------

interface OutcroppingCenter {
  phi: number; // latitude angle on sphere (0 = top, PI/2 = equator)
  theta: number; // longitude angle (0 to 2*PI)
  strength: number; // how far vertices are pushed out (as fraction of radius)
  influence: number; // angular radius of effect in radians
}

function getSphericalHillColor(
  heightFactor: number,
  displacement: number,
): THREE.Color {
  const darkSoil = new THREE.Color("#3d2b1a");
  const darkGreen = new THREE.Color("#1f4d0f");
  const midGreen = new THREE.Color("#3a6b1f");
  const lightGreen = new THREE.Color("#5a8c30");
  const rockyGrey = new THREE.Color("#6a6a5a");
  const darkShadow = new THREE.Color("#1a2a1a");

  // remap heightFactor with power curve
  // spreads color variation more evenly across slopes
  const h = Math.pow(heightFactor, 0.5); // square root -- more variation in mid range

  let baseColor: THREE.Color;
  if (h < 0.2) {
    baseColor = darkSoil.clone().lerp(darkGreen, h / 0.2);
  } else if (h < 0.5) {
    baseColor = darkGreen.clone().lerp(midGreen, (h - 0.2) / 0.3);
  } else if (h < 0.8) {
    baseColor = midGreen.clone().lerp(lightGreen, (h - 0.5) / 0.3);
  } else {
    baseColor = lightGreen.clone().lerp(rockyGrey, (h - 0.8) / 0.2);
  }

  // stronger displacement tinting
  const dispStrength = Math.min(Math.abs(displacement) * 5, 1); // was *3
  if (displacement > 0.02) {
    return baseColor.lerp(rockyGrey.clone(), dispStrength * 0.8);
  } else if (displacement < -0.02) {
    return baseColor.lerp(darkShadow.clone(), dispStrength * 0.6);
  }

  //tone down the colors so that they don't overwhelm the hill textures
  const strengths = [0.1, 0.2, 0.3];
  const VERTEX_COLOR_STRENGTH =
    strengths[Math.floor(Math.random() * strengths.length)];

  baseColor.lerp(new THREE.Color(1, 1, 1), 1 - VERTEX_COLOR_STRENGTH);

  return baseColor;
}

function generateOutcroppingCenters(
  count: number,
  rng: () => number,
): OutcroppingCenter[] {
  const centers: OutcroppingCenter[] = [];

  for (let i = 0; i < count; i++) {
    centers.push({
      // only place outcroppings on upper hemisphere (visible part)
      phi: rng() * Math.PI * 0.5, // 0 to 90 degrees latitude
      theta: rng() * Math.PI * 2, // full 360 degrees longitude
      strength: 0.15 + rng() * 0.25, // 15-40% of radius displacement
      influence: 0.4 + rng() * 0.4, // 0.4-0.8 radians influence radius
    });
  }

  return centers;
}

function getOutcroppingDisplacement(
  vertexPhi: number,
  vertexTheta: number,
  centers: OutcroppingCenter[],
): number {
  let totalDisplacement = -0.05; // slight inward erosion baseline

  for (const center of centers) {
    // angular distance from vertex to outcropping center
    // using spherical law of cosines
    const angularDist = Math.acos(
      Math.min(
        1,
        Math.max(
          -1,
          Math.sin(vertexPhi) * Math.sin(center.phi) +
            Math.cos(vertexPhi) *
              Math.cos(center.phi) *
              Math.cos(vertexTheta - center.theta),
        ),
      ),
    );

    if (angularDist < center.influence) {
      // smooth falloff using cosine -- 1 at center, 0 at edge
      const falloff =
        (Math.cos((angularDist / center.influence) * Math.PI) + 1) * 0.5;
      totalDisplacement += center.strength * falloff;
    }
  }

  return totalDisplacement;
}

export function generateSphericalHillGeometry(
  radius: number,
  seed: number,
  outcroppingCount = 4,
): THREE.BufferGeometry {
  const widthSegments = 24;
  const heightSegments = 24;

  let s = seed * 7919 + 12347;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // generate outcropping centers for this hill
  const centers = generateOutcroppingCenters(outcroppingCount, rng);

  const vertices: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // generate sphere vertices with displacement
  for (let lat = 0; lat <= heightSegments; lat++) {
    const phi = (lat / heightSegments) * Math.PI; // 0 = top, PI = bottom

    for (let lon = 0; lon <= widthSegments; lon++) {
      const theta = (lon / widthSegments) * Math.PI * 2;

      // base unit sphere position
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      // compute displacement for this vertex
      const displacement = getOutcroppingDisplacement(phi, theta, centers);

      // only displace upper hemisphere -- below equator stays smooth
      // blends out between equator and slightly below
      const hemisphereBlend = Math.max(
        0,
        Math.min(1, (Math.PI * 0.6 - phi) / (Math.PI * 0.1)),
      );

      // reduce displacement near the very top of a hill to prevent extreme outcroppings that look unnatural
      const topBlend = Math.min(1, phi / (Math.PI * 0.15)); // 0 at tip, 1 after 15 degrees
      const finalDisplacement = displacement * hemisphereBlend * topBlend;

      // displaced radius
      const r = radius * (1 + finalDisplacement);

      vertices.push(nx * r, ny * r, nz * r);

      // normals point outward from center
      normals.push(nx, ny, nz);

      // height factor -- 1 at top, 0 at equator/bottom
      const heightFactor = Math.max(0, ny); // ny = 1 at top, 0 at equator
      const col = getSphericalHillColor(heightFactor, finalDisplacement);
      colors.push(col.r, col.g, col.b);
    }
  }

  // build indices -- same quad pattern as before
  for (let lat = 0; lat < heightSegments; lat++) {
    for (let lon = 0; lon < widthSegments; lon++) {
      const a = lat * (widthSegments + 1) + lon;
      const b = a + widthSegments + 1;
      const c = a + 1;
      const d = b + 1;

      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);

  return geo;
}

export function generateTexturedSphericalHillGeometry(
  radius: number,
  seed: number,
  outcroppingCount = 4,
): THREE.BufferGeometry {
  const widthSegments = 24;
  const heightSegments = 24;

  let s = seed * 7919 + 12347;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // generate outcropping centers for this hill
  const centers = generateOutcroppingCenters(outcroppingCount, rng);

  const vertices: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  // generate sphere vertices with displacement
  for (let lat = 0; lat <= heightSegments; lat++) {
    const phi = (lat / heightSegments) * Math.PI; // 0 = top, PI = bottom

    for (let lon = 0; lon <= widthSegments; lon++) {
      const theta = (lon / widthSegments) * Math.PI * 2;

      // base unit sphere position
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      // compute displacement for this vertex
      const displacement = getOutcroppingDisplacement(phi, theta, centers);

      // only displace upper hemisphere -- below equator stays smooth
      // blends out between equator and slightly below
      const hemisphereBlend = Math.max(
        0,
        Math.min(1, (Math.PI * 0.6 - phi) / (Math.PI * 0.1)),
      );

      // reduce displacement near the very top of a hill to prevent extreme outcroppings that look unnatural
      const topBlend = Math.min(1, phi / (Math.PI * 0.15)); // 0 at tip, 1 after 15 degrees
      const finalDisplacement = displacement * hemisphereBlend * topBlend;

      // displaced radius
      const r = radius * (1 + finalDisplacement);

      vertices.push(nx * r, ny * r, nz * r);

      // normals point outward from center
      normals.push(nx, ny, nz);

      uvs.push(lon / widthSegments, 1 - lat / heightSegments);

      // height factor -- 1 at top, 0 at equator/bottom
      const heightFactor = Math.max(0, ny); // ny = 1 at top, 0 at equator

      const col = getSphericalHillColor(heightFactor, finalDisplacement);
      colors.push(col.r, col.g, col.b);
    }
  }

  // build indices -- same quad pattern as before
  for (let lat = 0; lat < heightSegments; lat++) {
    for (let lon = 0; lon < widthSegments; lon++) {
      const a = lat * (widthSegments + 1) + lon;
      const b = a + widthSegments + 1;
      const c = a + 1;
      const d = b + 1;

      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute(
    "uv2",
    new THREE.BufferAttribute(geo.attributes.uv.array, 2),
  );
  geo.setIndex(indices);

  //recalculate normals after displacement, otherwise texture shading will be whacky
  geo.computeVertexNormals();

  return geo;
}

export interface SphericalHillConfig {
  position: THREE.Vector3;
  radius: number;
  seed: number;
}

export function placeNearbySphericalHills(
  chunkId: number,
  worldPoints: THREE.Vector3[],
  exclusionZones: ExclusionZone[],
  minLateralDist = 65,
  maxLateralDist = 95,
  hillsPerSide = 2,
): SphericalHillConfig[] {
  const configs: SphericalHillConfig[] = [];
  const localZones = [...exclusionZones];
  // in placeNearbySphericalHills
  minLateralDist = FORCE_HILL_INTERSECTIONS ? 0 : minLateralDist;
  maxLateralDist = FORCE_HILL_INTERSECTIONS ? 10 : maxLateralDist;

  let s = chunkId * 6271 + 31337;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (const side of [-1, 1]) {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = hillsPerSide * 8;

    while (placed < hillsPerSide && attempts < maxAttempts) {
      attempts++;

      const pointIndex = Math.floor(rng() * (worldPoints.length - 2));
      const pos = worldPoints[pointIndex].clone();
      const next =
        worldPoints[Math.min(pointIndex + 1, worldPoints.length - 1)].clone();

      const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const lateralDist =
        minLateralDist + rng() * (maxLateralDist - minLateralDist);
      const hillPos = pos.clone().addScaledVector(right, side * lateralDist);
      hillPos.y = 0;

      const hillRadius = 8 + rng() * 10;

      // check against all exclusion zones
      if (isExcluded(hillPos, localZones, hillRadius)) continue;

      localZones.push({
        position: hillPos.clone(),
        radius: hillRadius + 8,
        type: "hill_sphere",
      });

      configs.push({
        position: hillPos,
        radius: hillRadius,
        seed: Math.floor(rng() * 100000),
      });

      placed++;
    }
  }

  return configs;
}
