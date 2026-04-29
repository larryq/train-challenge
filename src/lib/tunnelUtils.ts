import * as THREE from "three";

// ---- types ------------------------------------------------

export interface TunnelIntersection {
  pointsInsideHill: THREE.Vector3[];
  firstInsideIndex: number;
}

// ---- detection --------------------------------------------

export function detectHillIntersection(
  worldPoints: THREE.Vector3[],
  hillPosition: THREE.Vector3,
  hillRadius: number,
): TunnelIntersection | null {
  let firstInsideIndex = -1;
  const pointsInsideHill: THREE.Vector3[] = [];

  worldPoints.forEach((wp, i) => {
    const dx = wp.x - hillPosition.x;
    const dz = wp.z - hillPosition.z;
    if (Math.sqrt(dx * dx + dz * dz) < hillRadius) {
      if (firstInsideIndex === -1) firstInsideIndex = i;
      pointsInsideHill.push(wp);
    }
  });

  if (pointsInsideHill.length === 0) return null;

  return { pointsInsideHill, firstInsideIndex };
}

// ---- geometry carving -------------------------------------

export function carveHillGeometry(
  geo: THREE.BufferGeometry,
  hillWorldPos: THREE.Vector3,
  hillRadius: number,
  splinePoints: THREE.Vector3[],
  tunnelRadius: number,
): THREE.BufferGeometry {
  const positions = geo.attributes.position;
  const colors = geo.attributes.color;
  const normals = geo.attributes.normal;
  const indices = geo.index!.array;

  // check if a vertex is inside the tunnel zone
  const isInsideTunnel = (vertIndex: number): boolean => {
    // convert vertex from local to world space XZ
    const worldX = positions.getX(vertIndex) + hillWorldPos.x;
    const worldZ = positions.getZ(vertIndex) + hillWorldPos.z;

    return splinePoints.some(
      (wp) =>
        new THREE.Vector2(worldX, worldZ).distanceTo(
          new THREE.Vector2(wp.x, wp.z),
        ) < tunnelRadius,
    );
  };

  // filter triangles -- remove any where at least one vertex is in tunnel
  const newIndices: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];

    if (!isInsideTunnel(a) && !isInsideTunnel(b) && !isInsideTunnel(c)) {
      newIndices.push(a, b, c);
    }
  }

  // rebuild geometry with filtered indices
  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute("position", positions);
  if (colors) newGeo.setAttribute("color", colors);
  if (normals) newGeo.setAttribute("normal", normals);
  newGeo.setIndex(newIndices);

  return newGeo;
}

// ---- main entry point -------------------------------------
// call this from buildChunk after hills are placed and meshed

export function processTunnels(
  worldPoints: THREE.Vector3[],
  sphericalHillConfigs: Array<{
    position: THREE.Vector3;
    radius: number;
    seed: number;
  }>,
  hillMeshes: THREE.Mesh[],
  tunnelRadius = 0.5,
): void {
  sphericalHillConfigs.forEach((hillConfig, i) => {
    const intersection = detectHillIntersection(
      worldPoints,
      hillConfig.position,
      hillConfig.radius,
    );

    if (!intersection) return;

    console.log(
      `Tunnel: hill ${i} intersects track at ${intersection.pointsInsideHill.length} points`,
    );

    // get the mesh for this hill
    const mesh = hillMeshes[i];
    if (!mesh) return;

    // carve the geometry
    const carvedGeo = carveHillGeometry(
      mesh.geometry,
      hillConfig.position,
      hillConfig.radius,
      intersection.pointsInsideHill,
      tunnelRadius,
    );

    // replace geometry on the mesh
    mesh.geometry.dispose();
    mesh.geometry = carvedGeo;
  });
}
