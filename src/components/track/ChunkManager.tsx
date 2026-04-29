/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTrackStore } from "../../stores/useTrackStore";
import type { LoadedSegment } from "./SegmentPreloader";

import {
  placeSegment,
  getWorldPoints,
  concatenatePoints,
} from "../../lib/splineUtils";

import {
  type ExclusionZone,
  registerTrackCorridor,
  placeGrass,
  type GrassInstance,
  placeTrees,
  type ChunkTreeData,
  type TreeInstance,
} from "../../lib/placementUtils";

import {
  // placeNearbyHills,
  // generateNearbyHillGeometry,
  placeNearbySphericalHills,
  generateSphericalHillGeometry,
  generateTexturedSphericalHillGeometry,
} from "../../lib/hillUtils";

import {
  placeLandmarks,
  createLakeGeometry,
  createShoreGeometry,
  createFieldGeometry,
  createWaterMaterial,
  LANDMARK_CONFIG,
} from "../../lib/landmarkUtils";
import { processTunnels } from "../../lib/tunnelUtils";
import { useTexture } from "@react-three/drei";

// ---- types ------------------------------------------------
interface Chunk {
  id: number;
  group: THREE.Group;
  worldPoints: THREE.Vector3[];
  endPosition: THREE.Vector3;
  endDirection: THREE.Vector3;
  grassInstances: GrassInstance[];
  treeInstances: TreeInstance[];
}

export interface ChunkManagerProps {
  loadedSegments: Map<string, LoadedSegment>;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
  trainTRef: React.MutableRefObject<number>;
  chunksGrassRef: React.MutableRefObject<ChunkGrassData[]>;
  chunksTreeRef: React.MutableRefObject<ChunkTreeData[]>;
  cycleValue: number;
}

export interface ChunkGrassData {
  chunkId: number;
  instances: GrassInstance[];
}

// ---- constants --------------------------------------------

const CHUNK_TRIGGER_DISTANCE = 55; // build next chunk when train is this close to end
//const MASTER_CURVE_SAMPLES = 200; // resolution for findClosestT
// hill spawn animation settings
// set to 0 to disable either effect
const HILL_FADE_DURATION = 2000; // ms to fade from transparent to opaque
const HILL_GROW_DURATION = 1500; // ms to grow from flat to full height

// ---- helpers ----------------------------------------------

function weightedPick(
  library: { url: string; weight: number; tags: string[] }[],
): string {
  const total = library.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const seg of library) {
    r -= seg.weight;
    if (r <= 0) return seg.url;
  }
  return library[0].url;
}

function pickSegmentUrls(
  library: { url: string; weight: number; tags: string[] }[],
  count: number,
  prevTags: string[],
): string[] {
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    const lastTags =
      i === 0
        ? prevTags
        : (library.find((s) => s.url === urls[urls.length - 1])?.tags ?? []);

    const wasCurve = lastTags.includes("curve");

    // avoid two curves back to back
    const candidates = wasCurve
      ? library.filter((s) => !s.tags.includes("curve"))
      : library;

    urls.push(weightedPick(candidates.length > 0 ? candidates : library));
  }

  return urls;
}

function buildMasterCurve(chunks: Chunk[]): THREE.CatmullRomCurve3 {
  const allPointArrays = chunks.map((c) => c.worldPoints);
  const allPoints = concatenatePoints(allPointArrays);
  const curve = new THREE.CatmullRomCurve3(allPoints, false, "catmullrom", 0.5);
  curve.arcLengthDivisions = 1000;
  return curve;
}

function buildChunk(
  id: number,
  segmentUrls: string[],
  loadedSegments: Map<string, LoadedSegment>,
  prevEndPosition: THREE.Vector3,
  prevEndDirection: THREE.Vector3,
  threeScene: THREE.Scene,
  existingSplinePoints: THREE.Vector3[] = [],
  hillTextures: {
    map: THREE.Texture;
    normalMap: THREE.Texture;
    aoMap: THREE.Texture;
    displacementMap: THREE.Texture;
  },
  hillTextureSets: Array<{
    map: THREE.Texture;
    normalMap: THREE.Texture;
    aoMap: THREE.Texture;
  }>,
): Chunk {
  const group = new THREE.Group();
  group.name = `Chunk_${id}`;
  threeScene.add(group);

  const allWorldPointArrays: THREE.Vector3[][] = [];
  let currentEndPos = prevEndPosition.clone();
  let currentEndDir = prevEndDirection.clone();

  for (const url of segmentUrls) {
    const loaded = loadedSegments.get(url);
    if (!loaded) throw new Error(`Segment not loaded: ${url}`);

    const segGroup = loaded.scene.clone(true);
    group.add(segGroup);

    const data = loaded.data;

    // place against previous end
    placeSegment(segGroup, data, currentEndPos, currentEndDir);
    segGroup.updateMatrixWorld(true);

    // extract world space spline points BEFORE mesh correction
    // so the master curve is driven purely by JSON path data
    const worldPoints = getWorldPoints(segGroup, data.points);
    allWorldPointArrays.push(worldPoints);

    // update running end for next segment
    const last = worldPoints[worldPoints.length - 1];
    const secondLast = worldPoints[worldPoints.length - 2];
    currentEndPos = last.clone();
    currentEndDir = new THREE.Vector3()
      .subVectors(last, secondLast)
      .normalize();

    // clamp Y drift on flat segments
    if (Math.abs(currentEndDir.y) < 0.05) {
      currentEndDir.y = 0;
      currentEndDir.normalize();
      currentEndPos.y = 0;
      console.log("just reset y ending position");
    }

    // apply mesh offset correction -- purely visual
    // shifts mesh geometry to align with spline path
    // must come AFTER world points extraction
    if (data.meshOffset.lengthSq() > 0.001) {
      const correction = data.meshOffset
        .clone()
        .negate()
        .applyQuaternion(segGroup.quaternion);
      segGroup.position.add(correction);
      segGroup.updateMatrixWorld(true);
    }
  }

  const worldPoints = concatenatePoints(allWorldPointArrays);
  const endPos = worldPoints[worldPoints.length - 1].clone();
  const endDir = new THREE.Vector3()
    .subVectors(
      worldPoints[worldPoints.length - 1],
      worldPoints[worldPoints.length - 2],
    )
    .normalize();

  // clamp Y on chunk end direction too
  if (Math.abs(endDir.y) < 0.05) {
    endDir.y = 0;
    endDir.normalize();
    endPos.y = 0;
  }
  const tempCurve = new THREE.CatmullRomCurve3(
    worldPoints,
    false,
    "catmullrom",
    0.85,
  );

  // build exclusion zone registry for this chunk
  const exclusionZones: ExclusionZone[] = [];

  // step 1 -- register existing track from other active chunks
  // prevents hills from spawning where future track will be
  registerTrackCorridor(existingSplinePoints, 20, exclusionZones);

  // step 2 -- register this chunk's own track corridor
  registerTrackCorridor(worldPoints, 20, exclusionZones);

  // step 3 -- place stations (after track, before hills)
  // const stationConfigs = placeStations(id, worldPoints, exclusionZones)
  // stationConfigs.forEach(s => {
  //   exclusionZones.push({
  //     position: s.position.clone(),
  //     radius: 25,
  //     type: 'station',
  //   })
  // })

  //DEBUG BELOW-- UNCOMMENT TO HELP CAUSE HILLS TO INTERSECT TRACK
  //exclusionZones.length = 0;

  const sphericalHillConfigs = placeNearbySphericalHills(
    id,
    worldPoints,
    exclusionZones,
  );

  // register hill positions for future use
  // (trees, stations etc will read these later)
  sphericalHillConfigs.forEach((config) => {
    exclusionZones.push({
      position: config.position.clone(),
      radius: config.radius + 8,
      type: "hill_sphere",
    });
  });

  const sphericalHillMaterial = new THREE.MeshPhongMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: false,
    transparent: HILL_FADE_DURATION > 0,
    opacity: HILL_FADE_DURATION > 0 ? 0 : 1,
    shininess: 15, // subtle specular -- rocky but not glossy
  });

  const hillMeshes: THREE.Mesh[] = [];
  // sphericalHillConfigs.forEach((config) => {
  //   const geo = generateSphericalHillGeometry(
  //     config.radius,
  //     config.seed,
  //     4, // 4 outcropping centers per hill
  //   );

  //   const mesh = new THREE.Mesh(geo, sphericalHillMaterial.clone());
  //   mesh.name = "NearbyHill"; // same name -- reuses existing fade/grow animation

  //   // bury 55% underground
  //   mesh.position.copy(config.position);
  //   mesh.position.y = -config.radius * 0.55;

  //   mesh.userData.spawnTime = Date.now();

  //   if (HILL_GROW_DURATION > 0) {
  //     mesh.scale.y = 0.001;
  //   }

  //   group.add(mesh);

  //   //variable below used for track / hill intersection detection
  //   hillMeshes.push(mesh);
  // });

  ///TESTING

  const materialTexture = new THREE.MeshStandardMaterial({
    map: hillTextures.map,
    normalMap: hillTextures.normalMap,
    aoMap: hillTextures.aoMap,
    displacementMap: hillTextures.displacementMap,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
    vertexColors: Math.random() < 0.5,
    fog: false,
  });
  hillTextures.map.needsUpdate = true;
  hillTextures.normalMap.needsUpdate = true;
  hillTextures.aoMap.needsUpdate = true;
  hillTextures.displacementMap.needsUpdate = true;

  // const materialTexture = new THREE.MeshStandardMaterial({
  //   color: "#ff0000", // bright red
  //   vertexColors: false,
  //   fog: false,
  // });

  sphericalHillConfigs.forEach((config) => {
    const geo = generateTexturedSphericalHillGeometry(
      config.radius,
      config.seed,
      4, // 4 outcropping centers per hill
    );

    // pick texture set based on seed -- consistent per hill
    const setIndex = config.seed % hillTextureSets.length;
    const texSet = hillTextureSets[setIndex];

    const mat = new THREE.MeshStandardMaterial({
      map: texSet.map,
      normalMap: texSet.normalMap,
      aoMap: texSet.aoMap,
      roughness: 0.8,
      metalness: 0.0,
      side: THREE.DoubleSide,
      vertexColors: Math.random() > 0.99999,
      fog: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "NearbyHill"; // same name -- reuses existing fade/grow animation

    // bury 55% underground
    mesh.position.copy(config.position);
    mesh.position.y = -config.radius * 0.55;

    mesh.userData.spawnTime = Date.now();

    if (HILL_GROW_DURATION > 0) {
      mesh.scale.y = 0.001;
    }

    group.add(mesh);

    //variable below used for track / hill intersection detection
    hillMeshes.push(mesh);
  });

  //END TEST

  // process tunnels -- carve geometry where track intersects hills
  processTunnels(worldPoints, sphericalHillConfigs, hillMeshes);

  // store material reference for disposal
  (group as any).__hillMaterial = sphericalHillMaterial;

  const grassInstances = placeGrass(id, worldPoints);

  // ---- landmarks --------------------------------------------
  const { lakes, fields } = placeLandmarks(id, worldPoints, exclusionZones);

  // place trees -- after grass, uses same exclusion zones
  const treeInstances = placeTrees(id, worldPoints, exclusionZones);

  // shore material -- shared across lakes in this chunk
  const shoreMaterial = new THREE.MeshLambertMaterial({
    color: LANDMARK_CONFIG.LAKE_SHORE_COLOR,
    fog: true,
    transparent: true,
    opacity: 0,
  });

  // water material -- shared across lakes in this chunk
  const waterMaterial = new THREE.MeshLambertMaterial({
    color: LANDMARK_CONFIG.LAKE_WATER_COLOR,
    fog: false,
    transparent: false,
    opacity: 1,
  });

  // lakes.forEach((config) => {
  //   const shoreGeo = createShoreGeometry(
  //     config.radius,
  //     LANDMARK_CONFIG.LAKE_SHORE_WIDTH,
  //     config.seed,
  //   );
  //   const shoreMesh = new THREE.Mesh(
  //     shoreGeo,
  //     new THREE.MeshLambertMaterial({
  //       color: "#ba894a",
  //       side: THREE.DoubleSide,
  //     }),
  //   );
  //   shoreMesh.position.copy(config.position);
  //   shoreMesh.position.y = 0.05;
  //   shoreMesh.name = "LakeShore"; // ← add this
  //   shoreMesh.userData.spawnTime = Date.now();
  //   shoreMesh.userData.fadeDuration = LANDMARK_CONFIG.LAKE_FADE_DURATION;
  //   shoreMesh.userData.growDuration = LANDMARK_CONFIG.LAKE_GROW_DURATION;
  //   shoreMesh.userData.targetOpacity = 1.0;
  //   shoreMesh.scale.set(0.001, 1, 0.001);
  //   group.add(shoreMesh);

  //   const waterGeo = createLakeGeometry(config.radius, config.seed);
  //   const waterMesh = new THREE.Mesh(
  //     waterGeo,
  //     new THREE.MeshLambertMaterial({
  //       color: "#4a9aba",
  //       side: THREE.DoubleSide,
  //       transparent: true,
  //     }),
  //   );
  //   waterMesh.position.copy(config.position);
  //   waterMesh.position.y = 0.1;
  //   waterMesh.name = "LakeWater"; // ← add this
  //   waterMesh.userData.spawnTime = Date.now();
  //   waterMesh.userData.fadeDuration = LANDMARK_CONFIG.LAKE_FADE_DURATION;
  //   waterMesh.userData.growDuration = LANDMARK_CONFIG.LAKE_GROW_DURATION;
  //   waterMesh.userData.targetOpacity = LANDMARK_CONFIG.LAKE_OPACITY;
  //   waterMesh.scale.set(0.001, 1, 0.001);
  //   group.add(waterMesh);
  // });

  lakes.forEach((config) => {
    const spawnTime = Date.now();

    // shore mesh -- unchanged, uses MeshLambertMaterial
    const shoreGeo = createShoreGeometry(
      config.radius,
      LANDMARK_CONFIG.LAKE_SHORE_WIDTH,
      config.seed,
    );
    const shoreMat = new THREE.MeshLambertMaterial({
      color: LANDMARK_CONFIG.LAKE_SHORE_COLOR,
      fog: true,
      transparent: true,
      opacity: 0,
    });
    const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
    shoreMesh.position.copy(config.position);
    shoreMesh.position.y = 0.05;
    shoreMesh.name = "LakeShore";
    shoreMesh.userData.spawnTime = spawnTime;
    shoreMesh.userData.fadeDuration = LANDMARK_CONFIG.LAKE_FADE_DURATION;
    shoreMesh.userData.growDuration = LANDMARK_CONFIG.LAKE_GROW_DURATION;
    shoreMesh.userData.targetOpacity = 1.0;
    shoreMesh.scale.set(0.001, 1, 0.001);
    group.add(shoreMesh);

    // water mesh -- shader material
    const waterGeo = createLakeGeometry(config.radius, config.seed);
    const waterMat = createWaterMaterial(config, LANDMARK_CONFIG);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.copy(config.position);
    waterMesh.position.y = 0.1;
    waterMesh.name = "LakeWater";
    waterMesh.userData.spawnTime = spawnTime;
    waterMesh.userData.fadeDuration = LANDMARK_CONFIG.LAKE_FADE_DURATION;
    waterMesh.userData.growDuration = LANDMARK_CONFIG.LAKE_GROW_DURATION;
    waterMesh.userData.targetOpacity = LANDMARK_CONFIG.LAKE_OPACITY;
    waterMesh.scale.set(0.001, 1, 0.001);
    group.add(waterMesh);
  });

  fields.forEach((config) => {
    const fieldGeo = createFieldGeometry(config.size, config.seed);
    const fieldMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      fog: true,
      transparent: true,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const fieldMesh = new THREE.Mesh(fieldGeo, fieldMat);
    fieldMesh.position.copy(config.position);
    fieldMesh.rotation.y = config.rotation;
    fieldMesh.name = "Field";
    fieldMesh.userData.spawnTime = Date.now();
    fieldMesh.userData.fadeDuration = LANDMARK_CONFIG.FIELD_FADE_DURATION;
    fieldMesh.userData.growDuration = 0; // fields don't grow -- just fade
    fieldMesh.userData.targetOpacity = 1.0;
    group.add(fieldMesh);
  });

  return {
    id,
    group,
    worldPoints,
    endPosition: endPos,
    endDirection: endDir,
    grassInstances,
    treeInstances,
  };
}

function disposeChunk(chunk: Chunk, threeScene: THREE.Scene): void {
  threeScene.remove(chunk.group);
  chunk.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material?.dispose();
      }
    }
  });
  const hillMaterial = (chunk.group as any).__hillMaterial;
  if (hillMaterial) hillMaterial.dispose();
}

// ---- component --------------------------------------------

export function ChunkManager({
  loadedSegments,
  trainPositionRef,
  masterCurveRef,
  trainTRef,
  chunksGrassRef,
  chunksTreeRef,
  cycleValue,
}: ChunkManagerProps) {
  const { scene } = useThree();
  const segmentLibrary = useTrackStore((s) => s.segmentLibrary);
  const segmentsPerChunk = useTrackStore((s) => s.segmentsPerChunk);
  const chunksToPreload = useTrackStore((s) => s.chunksToPreload);
  const advanceChunk = useTrackStore((s) => s.advanceChunk);
  const setReady = useTrackStore((s) => s.setReady);

  const chunksRef = useRef<Chunk[]>([]);
  const chunkIdCounter = useRef(0);
  const isBuildingRef = useRef(false);
  const lastEndTagsRef = useRef<string[]>(["straight"]);
  const isReadyRef = useRef(false);
  const pendingBuildRef = useRef(false);
  const removedArcLengthRef = useRef(0);

  const rebuildMasterCurve2 = useCallback(() => {
    if (chunksRef.current.length === 0) return;

    const oldCurve = masterCurveRef.current;
    const newCurve = buildMasterCurve(chunksRef.current);

    if (oldCurve) {
      // get train's actual world position before curve changes
      const trainWorldPos = trainPositionRef.current.clone();

      // find closest point on new curve to that world position
      // search in small increments -- more accurate than arc length math
      let bestT = 0;
      let bestDist = Infinity;
      const steps = 500;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = newCurve.getPointAt(t);
        const dist = pt.distanceTo(trainWorldPos);

        if (dist < bestDist) {
          bestDist = dist;
          bestT = t;
        }
      }

      // refine with a finer search around the best t
      const refineRange = 1 / steps;
      for (let i = 0; i <= 100; i++) {
        const t = bestT - refineRange + (i / 100) * refineRange * 2;
        const pt = newCurve.getPointAt(THREE.MathUtils.clamp(t, 0, 0.9999));
        const dist = pt.distanceTo(trainWorldPos);

        if (dist < bestDist) {
          bestDist = dist;
          bestT = t;
        }
      }

      trainTRef.current = THREE.MathUtils.clamp(bestT, 0, 0.9999);
      removedArcLengthRef.current = 0; // no longer needed
    }

    masterCurveRef.current = newCurve;
  }, [masterCurveRef, trainTRef, trainPositionRef]);

  const rebuildMasterCurve = useCallback(() => {
    if (chunksRef.current.length === 0) return;

    const oldCurve = masterCurveRef.current;
    const newCurve = buildMasterCurve(chunksRef.current);

    if (oldCurve) {
      const oldLength = oldCurve.getLength();
      const newLength = newCurve.getLength();

      // how far along the old curve is the train in world units
      const arcPosition = trainTRef.current * oldLength;

      // read and immediately reset -- prevents double application
      const removedArc = removedArcLengthRef.current;
      removedArcLengthRef.current = 0; // reset BEFORE computing newT

      // subtract any arc length removed from the front
      // when a chunk was despawned
      const adjustedArcPosition = arcPosition - removedArc;

      const newT = adjustedArcPosition / newLength;

      trainTRef.current = THREE.MathUtils.clamp(newT, 0, 0.9999);
    }

    masterCurveRef.current = newCurve;
  }, [masterCurveRef, trainTRef]);

  const hillTextures = useTexture({
    map: "/textures/grass_path_3_diff_1k.jpg",
    normalMap: "/textures/grass_path_3_nor_gl_1k.jpg",
    aoMap: "/textures/grass_path_3_ao_1k.jpg",
    displacementMap: "/textures/grass_path_3_disp_1k.jpg",
  });

  const textureSet1 = useTexture({
    map: "/textures/grass_path_3_diff_1k.jpg",
    normalMap: "/textures/grass_path_3_nor_gl_1k.jpg",
    aoMap: "/textures/grass_path_3_ao_1k.jpg",
    displacementMap: "/textures/grass_path_3_disp_1k.jpg",
  });
  const textureSet2 = useTexture({
    map: "/textures/Ground037_1K-JPG_Color.jpg",
    normalMap: "/textures/Ground037_1K-JPG_NormalGL.jpg",
    aoMap: "/textures/Ground037_1K-JPG_AmbientOcclusion.jpg",
  });
  const textureSet3 = useTexture({
    map: "/textures/coast_sand_rocks_02_diff_1k.jpg",
    normalMap: "/textures/coast_sand_rocks_02_nor_gl_1k.jpg",
    aoMap: "/textures/coast_sand_rocks_02_ao_1k.jpg",
  });
  const textureSet4 = useTexture({
    map: "/textures/snow_02_diff_1k.jpg",
    normalMap: "/textures/snow_02_nor_gl_1k.jpg",
    aoMap: "/textures/snow_02_ao_1k.jpg",
  });

  const hillTexturesRef = useRef(hillTextures);
  useEffect(() => {
    hillTexturesRef.current = hillTextures;
  }, [hillTextures]);

  const hillTextureSetsRef = useRef<
    Array<{
      map: THREE.Texture;
      normalMap: THREE.Texture;
      aoMap: THREE.Texture;
    }>
  >([]);

  useEffect(() => {
    const sets = [textureSet1, /*textureSet2,*/ textureSet3, textureSet4];

    hillTextureSetsRef.current = sets.map((set) => {
      const map = set.map.clone();
      const normalMap = set.normalMap.clone();
      const aoMap = set.aoMap.clone();

      [map, normalMap, aoMap].forEach((tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(12, 12);
        tex.needsUpdate = true;
      });

      map.colorSpace = THREE.SRGBColorSpace;

      return { map, normalMap, aoMap };
    });
  });

  // build one chunk and append it
  const buildNextChunk = useCallback(() => {
    if (isBuildingRef.current) return;
    isBuildingRef.current = true;

    try {
      const prevChunk = chunksRef.current[chunksRef.current.length - 1];
      const prevEndPos = prevChunk
        ? prevChunk.endPosition
        : new THREE.Vector3(0, 0, 0);
      const prevEndDir = prevChunk
        ? prevChunk.endDirection
        : new THREE.Vector3(0, 0, 1);

      const urls = pickSegmentUrls(
        segmentLibrary,
        segmentsPerChunk,
        lastEndTagsRef.current,
      );

      // gather all currently active spline points
      // hills in new chunk will avoid these
      const existingSplinePoints: THREE.Vector3[] = [];
      chunksRef.current.forEach((chunk) => {
        existingSplinePoints.push(...chunk.worldPoints);
      });

      const chunk = buildChunk(
        chunkIdCounter.current++,
        urls,
        loadedSegments,
        prevEndPos,
        prevEndDir,
        scene,
        existingSplinePoints, // pass existing points
        hillTexturesRef.current,
        hillTextureSetsRef.current,
      );

      chunksRef.current.push(chunk);

      const lastUrl = urls[urls.length - 1];
      lastEndTagsRef.current = segmentLibrary.find((s) => s.url === lastUrl)
        ?.tags ?? ["straight"];

      rebuildMasterCurve();
      advanceChunk();
    } catch (err) {
      console.error("ChunkManager: failed to build chunk:", err);
    } finally {
      isBuildingRef.current = false;
    }
  }, [
    scene,
    segmentLibrary,
    segmentsPerChunk,
    advanceChunk,
    rebuildMasterCurve,
    loadedSegments,
  ]);

  // despawn oldest chunk
  const despawnOldestChunk = useCallback(() => {
    const oldest = chunksRef.current.shift();
    if (!oldest) return;

    // record arc length being removed from start of curve
    // rebuildMasterCurve uses this to correctly remap train t
    const removedCurve = new THREE.CatmullRomCurve3(
      oldest.worldPoints,
      false,
      "catmullrom",
      0.5,
    );
    removedCurve.arcLengthDivisions = 1000;
    removedArcLengthRef.current += removedCurve.getLength();

    disposeChunk(oldest, scene);

    rebuildMasterCurve();

    console.log(`ChunkManager: despawned chunk ${oldest.id}`);
  }, [scene, rebuildMasterCurve]);

  useEffect(() => {
    const textures = hillTexturesRef.current;
    Object.values(textures).forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(12, 12);
    });
    textures.map.colorSpace = THREE.SRGBColorSpace;
  }, []);

  useEffect(() => {
    // build chunks one at a time, each waiting for the previous
    const buildAll = () => {
      for (let i = 0; i < chunksToPreload; i++) {
        buildNextChunk();
      }
      isReadyRef.current = true;
      setReady(true);
    };

    // defer to next frame so scene is fully mounted
    const timeout = setTimeout(buildAll, 0);
    return () => {
      console.log("CLEANUP: removing", chunksRef.current.length, "chunks");
      clearTimeout(timeout);
      // clean up any chunks built during this mount
      // prevents duplicate chunks on React strict mode remount
      chunksRef.current.forEach((chunk) => {
        disposeChunk(chunk, scene);
      });
      chunksRef.current = [];
      chunkIdCounter.current = 0;
      isReadyRef.current = false;
      removedArcLengthRef.current = 0;
      masterCurveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildNextChunk, chunksToPreload, setReady]);

  useFrame(() => {
    if (HILL_FADE_DURATION > 0 || HILL_GROW_DURATION > 0) {
      const now = Date.now();

      chunksRef.current.forEach((chunk) => {
        chunk.group.traverse((obj) => {
          if (
            obj.name !== "NearbyHill" &&
            obj.name !== "LakeWater" &&
            obj.name !== "LakeShore" &&
            obj.name !== "Field"
          )
            return;

          const mesh = obj as THREE.Mesh;
          const mat = mesh.material as
            | THREE.MeshLambertMaterial
            | THREE.MeshPhongMaterial;
          const elapsed = now - (mesh.userData.spawnTime ?? now);

          // grow animation -- XZ scale for lakes, Y scale for hills
          const growDuration = mesh.userData.growDuration ?? HILL_GROW_DURATION;

          if (growDuration > 0) {
            const t = Math.min(elapsed / growDuration, 1);
            const s = 1 - Math.pow(1 - t, 3); // cubic ease out

            if (mesh.name === "LakeWater" || mesh.name === "LakeShore") {
              // lakes grow outward on XZ
              mesh.scale.set(s, 1, s);
            } else if (mesh.name === "NearbyHill") {
              // hills grow upward on Y
              mesh.scale.y = s;
            }
            // fields don't grow
          }

          // fade animation
          const fadeDuration = mesh.userData.fadeDuration ?? HILL_FADE_DURATION;
          const targetOpacity = mesh.userData.targetOpacity ?? 1.0;
          const t = Math.min(elapsed / fadeDuration, 1);
          const currentOpacity = t * targetOpacity;

          if (mesh.name === "LakeWater") {
            // shader material -- write to uniform and update time
            const shaderMat = mesh.material as THREE.ShaderMaterial;
            shaderMat.uniforms.uOpacity.value = currentOpacity;
            shaderMat.uniforms.uTime.value = Date.now() * 0.001;
          } else {
            // standard material -- write to opacity
            const stdMat = mesh.material as
              | THREE.MeshLambertMaterial
              | THREE.MeshPhongMaterial;
            if (stdMat.opacity < targetOpacity) {
              stdMat.opacity = currentOpacity;
              stdMat.needsUpdate = true;
            }
          }

          //darken hills at night
          if (obj.name === "NearbyHill") {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.aoMap) {
              mat.aoMapIntensity = THREE.MathUtils.lerp(0.8, 1.8, cycleValue);
              mat.needsUpdate = true;
            }
          }
        });
      });
    }

    if (!isReadyRef.current) return;
    if (chunksRef.current.length === 0) return;

    const trainPos = trainPositionRef.current;
    const lastChunk = chunksRef.current[chunksRef.current.length - 1];
    const distToEnd = trainPos.distanceTo(lastChunk.endPosition);

    // clear pending flag once new chunk end is far enough away
    if (pendingBuildRef.current && distToEnd > CHUNK_TRIGGER_DISTANCE * 1.2) {
      pendingBuildRef.current = false;
    }

    // build next chunk when close to end
    if (distToEnd < CHUNK_TRIGGER_DISTANCE && !pendingBuildRef.current) {
      pendingBuildRef.current = true;
      buildNextChunk();
    }

    // despawn only if no build pending
    const DESPAWN_DISTANCE = 120;
    if (!pendingBuildRef.current && chunksRef.current.length > 2) {
      const oldestChunk = chunksRef.current[0];
      const distToOldest = trainPos.distanceTo(oldestChunk.endPosition);
      if (distToOldest > DESPAWN_DISTANCE && chunksRef.current.length > 2) {
        despawnOldestChunk();
      }
    }

    const currentIds = chunksGrassRef.current.map((c) => c.chunkId).join(",");
    const newIds = chunksRef.current.map((c) => c.id).join(",");

    if (currentIds !== newIds) {
      chunksGrassRef.current = chunksRef.current.map((c) => ({
        chunkId: c.id,
        instances: c.grassInstances,
      }));
    }

    // update tree ref
    const currentTreeIds = chunksTreeRef.current
      .map((c) => c.chunkId)
      .join(",");
    if (currentTreeIds !== newIds) {
      chunksTreeRef.current = chunksRef.current.map((c) => ({
        chunkId: c.id,
        instances: c.treeInstances,
      }));
    }
  });

  return null;
}
