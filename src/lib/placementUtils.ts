import * as THREE from "three";
import { tooCloseToExisting } from "./hillUtils";

export type ExclusionType =
  | "track"
  | "station"
  | "hill_dome"
  | "hill_sphere"
  | "tree"
  | "poi";

export interface ExclusionZone {
  position: THREE.Vector3;
  radius: number;
  type: ExclusionType;
}

// check if a position conflicts with any existing exclusion zone
export function isExcluded(
  position: THREE.Vector3,
  zones: ExclusionZone[],
  extraRadius = 0, // optional extra buffer on top of zone radius
): boolean {
  return zones.some((zone) => {
    // XZ only -- we don't care about Y distance for terrain placement
    const dx = position.x - zone.position.x;
    const dz = position.z - zone.position.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);
    return distXZ < zone.radius + extraRadius;
  });
}

// register a line of exclusion zones along spline points
// used to mark the track corridor
export function registerTrackCorridor(
  worldPoints: THREE.Vector3[],
  radius: number,
  zones: ExclusionZone[],
): void {
  // don't register every point -- every Nth is enough
  // track corridor is continuous so gaps smaller than radius are fine
  const stride = Math.max(1, Math.floor(radius * 0.5));

  for (let i = 0; i < worldPoints.length; i += stride) {
    zones.push({
      position: worldPoints[i].clone(),
      radius,
      type: "track",
    });
  }
}

export interface GrassInstance {
  position: THREE.Vector3;
  rotation: number; // Y axis rotation in radians
  scale: number; // uniform scale
  colorIndex: 0 | 1 | 2; // maps to color palette
}

export function placeGrass(
  chunkId: number,
  worldPoints: THREE.Vector3[],
  countPerSide = 200, // grass tufts per side of track
  trackClearance = 4, // units from track center to avoid
  lateralSpread = 50, // how far from track grass extends
): GrassInstance[] {
  const instances: GrassInstance[] = [];

  // seeded random -- same chunk always gets same grass
  let s = chunkId * 13337 + 54321;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (const side of [-1, 1]) {
    for (let i = 0; i < countPerSide; i++) {
      // pick random point along spline
      const pointIndex = Math.floor(rng() * (worldPoints.length - 2));
      const pos = worldPoints[pointIndex].clone();
      const next =
        worldPoints[Math.min(pointIndex + 1, worldPoints.length - 1)];

      // get perpendicular direction
      const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // random lateral distance -- between clearance and spread
      const lateralDist =
        trackClearance + rng() * (lateralSpread - trackClearance);

      const grassPos = pos.clone().addScaledVector(right, side * lateralDist);
      grassPos.y = 0; // sit on ground

      instances.push({
        position: grassPos,
        rotation: rng() * Math.PI * 2,
        scale: 0.2 + rng() * 0.3,
        colorIndex: Math.floor(rng() * 3) as 0 | 1 | 2,
      });
    }
  }

  return instances;
}

// ---- trees ------------------------------------------------

export interface TreeInstance {
  position: THREE.Vector3;
  rotation: number; // Y axis rotation
  scale: number; // uniform scale
  varietyIndex: 0 | 1 | 2; // which GLB/geometry to use
}

export interface ChunkTreeData {
  chunkId: number;
  instances: TreeInstance[];
}

const TREE_MIN_SPACING = 4; // minimum distance between trees

export function placeTrees(
  chunkId: number,
  worldPoints: THREE.Vector3[],
  exclusionZones: ExclusionZone[],
  countPerSide = 30,
  minLateral = 10,
  maxLateral = 50,
): TreeInstance[] {
  const instances: TreeInstance[] = [];
  const placedPositions: THREE.Vector3[] = [];

  let s = chunkId * 2971 + 11317;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // variety weights -- A=pine most common, C=dead rarest
  const varietyWeights = [0.5, 0.35, 0.15];
  let lastVariety: 0 | 1 | 2 = 0;

  const pickVariety = (): 0 | 1 | 2 => {
    // grove bias -- 40% chance of repeating last variety
    if (rng() < 0.4) return lastVariety;

    const r = rng();
    if (r < varietyWeights[0]) return 0;
    if (r < varietyWeights[0] + varietyWeights[1]) return 1;
    return 2;
  };

  for (const side of [-1, 1]) {
    let attempts = 0;
    let placed = 0;
    const maxAttempts = countPerSide * 4;

    while (placed < countPerSide && attempts < maxAttempts) {
      attempts++;

      const pointIndex = Math.floor(rng() * (worldPoints.length - 2));
      const pos = worldPoints[pointIndex].clone();
      const next =
        worldPoints[Math.min(pointIndex + 1, worldPoints.length - 1)];

      const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const lateralDist = minLateral + rng() * (maxLateral - minLateral);
      const treePos = pos.clone().addScaledVector(right, side * lateralDist);
      treePos.y = 0;

      // track clearance
      const tooCloseToTrack = worldPoints.some(
        (wp) =>
          new THREE.Vector2(treePos.x, treePos.z).distanceTo(
            new THREE.Vector2(wp.x, wp.z),
          ) < minLateral,
      );
      if (tooCloseToTrack) continue;

      // exclusion zones -- hills, lakes, fields
      if (isExcluded(treePos, exclusionZones, 3)) continue;

      // tree spacing
      if (tooCloseToExisting(treePos, placedPositions, TREE_MIN_SPACING))
        continue;

      placedPositions.push(treePos.clone());

      const variety = pickVariety();
      lastVariety = variety;

      instances.push({
        position: treePos,
        rotation: rng() * Math.PI * 2,
        scale: 0.7 + rng() * 0.7, // 0.7 to 1.4
        varietyIndex: variety,
      });

      placed++;
    }
  }

  return instances;
}
