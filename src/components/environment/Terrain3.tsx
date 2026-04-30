/* eslint-disable react-hooks/immutability */
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type {
  TerrainCycleState,
  TerrainSet,
} from "../../hooks/useTerrainCycle";

interface Terrain3Props {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  cycleValue: number;
  terrainCycle: TerrainCycleState;
}

const TEXTURE_REPEAT = 30;
const PLANE_SIZE = 600;

function useTerrainMaterial(set: TerrainSet, cycleValue: number) {
  const [colorMap, normalMap, aoMap] = useTexture([
    set.textures.map,
    set.textures.normalMap,
    set.textures.aoMap,
  ]);

  useMemo(() => {
    [colorMap, normalMap, aoMap].forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);
    });
    colorMap.colorSpace = THREE.SRGBColorSpace;
  }, [colorMap, normalMap, aoMap]);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  // update AO and normal scale with day/night cycle
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.aoMapIntensity = THREE.MathUtils.lerp(0.8, 1.5, cycleValue);
    matRef.current.normalScale.setScalar(
      THREE.MathUtils.lerp(1.0, 1.8, cycleValue),
    );
  }, [cycleValue]);

  return { colorMap, normalMap, aoMap, matRef };
}

export function Terrain3({
  trainPositionRef,
  cycleValue,
  terrainCycle,
}: Terrain3Props) {
  const meshARef = useRef<THREE.Mesh>(null);
  const meshBRef = useRef<THREE.Mesh>(null);
  const matARef = useRef<THREE.MeshStandardMaterial>(null);
  const matBRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastPosRef = useRef(new THREE.Vector3());

  const {
    colorMap: colorMapA,
    normalMap: normalMapA,
    aoMap: aoMapA,
  } = useTerrainMaterial(terrainCycle.currentSet, cycleValue);
  const {
    colorMap: colorMapB,
    normalMap: normalMapB,
    aoMap: aoMapB,
  } = useTerrainMaterial(terrainCycle.nextSet, cycleValue);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 4, 4);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useFrame(() => {
    const trainPos = trainPositionRef.current;
    const dx = trainPos.x - lastPosRef.current.x;
    const dz = trainPos.z - lastPosRef.current.z;
    lastPosRef.current.copy(trainPos);

    const tileWorldSize = PLANE_SIZE / TEXTURE_REPEAT;
    const offsetX = -(trainPos.x / tileWorldSize) % 1.0;
    const offsetZ = -(trainPos.z / tileWorldSize) % 1.0;

    // update both planes' positions and texture offsets
    [
      { meshRef: meshARef, maps: [colorMapA, normalMapA, aoMapA] },
      { meshRef: meshBRef, maps: [colorMapB, normalMapB, aoMapB] },
    ].forEach(({ meshRef, maps }) => {
      if (!meshRef.current) return;
      meshRef.current.position.x = trainPos.x;
      meshRef.current.position.z = trainPos.z;

      maps.forEach((map) => {
        map.offset.set(-offsetX, offsetZ);
      });
    });

    // crossfade opacity
    const blend = terrainCycle.blendFactor;
    if (matARef.current) matARef.current.opacity = 1.0 - blend;
    if (matBRef.current) matBRef.current.opacity = blend;

    // AO and normal scale from day/night
    if (matARef.current) {
      matARef.current.aoMapIntensity = THREE.MathUtils.lerp(
        0.8,
        1.5,
        cycleValue,
      );
      matARef.current.normalScale.setScalar(
        THREE.MathUtils.lerp(1.0, 1.8, cycleValue),
      );
    }
    if (matBRef.current) {
      matBRef.current.aoMapIntensity = THREE.MathUtils.lerp(
        0.8,
        1.5,
        cycleValue,
      );
      matBRef.current.normalScale.setScalar(
        THREE.MathUtils.lerp(1.0, 1.8, cycleValue),
      );
    }
  });

  return (
    <>
      {/* current terrain -- fades out during transition */}
      <mesh
        ref={meshARef}
        geometry={geometry}
        position={[0, -0.15, 0]}
        receiveShadow
        renderOrder={-1}
      >
        <meshStandardMaterial
          ref={matARef}
          map={colorMapA}
          normalMap={normalMapA}
          normalScale={new THREE.Vector2(1, 1)}
          aoMap={aoMapA}
          aoMapIntensity={0.8}
          roughness={0.8}
          metalness={0.0}
          transparent
          opacity={1.0}
          polygonOffset
          polygonOffsetFactor={4}
          polygonOffsetUnits={4}
        />
      </mesh>

      {/* next terrain -- fades in during transition */}
      <mesh
        ref={meshBRef}
        geometry={geometry}
        position={[0, -0.14, 0]} // very slightly above plane A
        receiveShadow
        renderOrder={0}
      >
        <meshStandardMaterial
          ref={matBRef}
          map={colorMapB}
          normalMap={normalMapB}
          normalScale={new THREE.Vector2(1, 1)}
          aoMap={aoMapB}
          aoMapIntensity={0.8}
          roughness={0.8}
          metalness={0.0}
          transparent
          opacity={0.0} // starts invisible
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
    </>
  );
}
