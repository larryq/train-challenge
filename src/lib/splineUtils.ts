import * as THREE from "three";

export interface SegmentJSON {
  name: string;
  meshOffset?: { x: number; y: number; z: number };
  pointCount: number;
  points: { x: number; y: number; z: number }[];
}

export interface SegmentData {
  points: THREE.Vector3[];
  startPosition: THREE.Vector3;
  startDirection: THREE.Vector3;
  endPosition: THREE.Vector3;
  endDirection: THREE.Vector3;
  meshOffset: THREE.Vector3;
}

export async function loadSegmentJSON(url: string): Promise<SegmentData> {
  const jsonUrl = url.replace(".glb", ".json");
  const response = await fetch(jsonUrl);
  if (!response.ok) {
    throw new Error(`Failed to load segment JSON: ${jsonUrl}`);
  }

  const data: SegmentJSON = await response.json();

  if (!data.points || data.points.length < 2) {
    throw new Error(`Insufficient points in: ${jsonUrl}`);
  }

  const points = data.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));

  // mesh offset -- where the curve entry was in world space
  // this is the correction needed to align mesh to spline
  const meshOffset = data.meshOffset
    ? new THREE.Vector3(data.meshOffset.x, data.meshOffset.y, data.meshOffset.z)
    : new THREE.Vector3(0, 0, 0);

  const analysis = analyzePoints(points);

  return {
    ...analysis,
    meshOffset,
  };
}

// export function analyzePoints(rawPoints: THREE.Vector3[]) {
//   // build a curve through the control points
//   const tempCurve = new THREE.CatmullRomCurve3(
//     rawPoints,
//     false,
//     "catmullrom",
//     0.5,
//   );

//   // resample evenly -- gives clean consistent point spacing
//   const points = tempCurve.getPoints(60);

//   const startPosition = points[0].clone();
//   const startDirection = new THREE.Vector3()
//     .subVectors(points[1], points[0])
//     .normalize();

//   const endPosition = points[points.length - 1].clone();
//   const endDirection = new THREE.Vector3()
//     .subVectors(points[points.length - 1], points[points.length - 2])
//     .normalize();

//   // clamp Y on directions to prevent drift accumulation
//   // on flat segments -- slope segments will override this
//   if (Math.abs(endDirection.y) < 0.1) {
//     startDirection.y = 0;
//     startDirection.normalize();
//     endDirection.y = 0;
//     endDirection.normalize();
//   }

//   return {
//     points,
//     startPosition,
//     startDirection,
//     endPosition,
//     endDirection,
//   };
// }

export function analyzePoints(rawPoints: THREE.Vector3[]) {
  const tempCurve = new THREE.CatmullRomCurve3(
    rawPoints,
    false,
    "catmullrom",
    0.5,
  );

  const points = tempCurve.getPoints(300);

  const startPosition = points[0].clone();
  const endPosition = points[points.length - 1].clone();

  // use wider sample for direction -- more stable than adjacent points
  // points[5] is ~8% along the curve -- past initial wobble
  const startDirection = new THREE.Vector3()
    .subVectors(points[5], points[0])
    .normalize();

  // points[55] is ~92% along -- before end wobble
  const endDirection = new THREE.Vector3()
    .subVectors(points[points.length - 1], points[points.length - 6])
    .normalize();

  // clamp Y on flat segments
  if (Math.abs(startDirection.y) < 0.1) {
    startDirection.y = 0;
    startDirection.normalize();
  }

  if (Math.abs(endDirection.y) < 0.1) {
    endDirection.y = 0;
    endDirection.normalize();
  }

  return {
    points,
    startPosition,
    startDirection,
    endPosition,
    endDirection,
  };
}

export function placeSegment(
  segmentRoot: THREE.Group,
  data: SegmentData,
  prevEndPosition: THREE.Vector3,
  prevEndDirection: THREE.Vector3,
): void {
  // rotation to align segment's start direction with prev end direction
  const rotationQuat = new THREE.Quaternion().setFromUnitVectors(
    data.startDirection.clone().normalize(),
    prevEndDirection.clone().normalize(),
  );

  segmentRoot.quaternion.copy(rotationQuat);
  segmentRoot.updateMatrixWorld();

  // find where start lands after rotation
  const rotatedStart = data.startPosition.clone().applyQuaternion(rotationQuat);

  // offset so rotated start lands on prev end
  segmentRoot.position.copy(prevEndPosition).sub(rotatedStart);

  segmentRoot.updateMatrixWorld();
}

export function getWorldPoints(
  segmentRoot: THREE.Group,
  localPoints: THREE.Vector3[],
): THREE.Vector3[] {
  return localPoints.map((p) => {
    const worldPoint = p.clone();
    segmentRoot.localToWorld(worldPoint);
    return worldPoint;
  });
}

export function concatenatePoints(
  pointArrays: THREE.Vector3[][],
  junctionThreshold = 0.05,
): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];

  for (const points of pointArrays) {
    for (const point of points) {
      if (result.length === 0) {
        result.push(point.clone());
        continue;
      }
      if (point.distanceTo(result[result.length - 1]) > junctionThreshold) {
        result.push(point.clone());
      }
    }
  }

  return result;
}
