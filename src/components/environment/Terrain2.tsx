/* eslint-disable react-hooks/immutability */
import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface Terrain2Props {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

const TEXTURE_REPEAT = 30; // how many times texture tiles across the plane
const PLANE_SIZE = 600; // world units

export function Terrain2({ trainPositionRef }: Terrain2Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const lastPosRef = useRef(new THREE.Vector3());
  const { gl } = useThree();

  // load all three texture maps
  // const [colorMap, normalMap, aoMap] = useTexture([
  //   "/textures/rocky_terrain_02_diff_1k.jpg",
  //   "/textures/rocky_terrain_02_nor_gl_1k.jpg",
  //   "/textures/rocky_terrain_02_ao_1k.jpg",
  // ]);

  // const [colorMap, normalMap, aoMap] = useTexture([
  //   "/textures/Ground037_1K-JPG_Color.jpg",
  //   "/textures/Ground037_1K-JPG_NormalGL.jpg",
  //   "/textures/Ground037_1K-JPG_AmbientOcclusion.jpg",
  // ]);

  const [colorMap, normalMap, aoMap] = useTexture([
    "/textures/coast_sand_rocks_02_diff_1k.jpg",
    "/textures/coast_sand_rocks_02_nor_gl_1k.jpg",
    "/textures/coast_sand_rocks_02_ao_1k.jpg",
  ]);

  // configure all maps identically
  useMemo(() => {
    [colorMap, normalMap, aoMap].forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);
    });
  }, [colorMap, normalMap, aoMap]);

  const geometry = useMemo(() => {
    // low subdivision -- texture does the detail work
    const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 4, 4);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  //   useFrame(() => {
  //     if (!meshRef.current || !matRef.current) return;

  //     const trainPos = trainPositionRef.current;

  //     // compute movement delta
  //     const dx = trainPos.x - lastPosRef.current.x;
  //     const dz = trainPos.z - lastPosRef.current.z;
  //     lastPosRef.current.copy(trainPos);

  //     // scroll all texture maps to compensate for plane movement
  //     // negate because plane moves forward so texture must scroll backward
  //     const offsetX = dx / (PLANE_SIZE / TEXTURE_REPEAT);
  //     const offsetZ = dz / (PLANE_SIZE / TEXTURE_REPEAT);

  //     colorMap.offset.x += offsetX;
  //     colorMap.offset.y += offsetZ;
  //     normalMap.offset.x += offsetX;
  //     normalMap.offset.y += offsetZ;
  //     aoMap.offset.x += offsetX;
  //     aoMap.offset.y += offsetZ;

  //     // keep offset in 0-1 range -- texture repeats so this is seamless
  //     colorMap.offset.x = colorMap.offset.x % 1.0;
  //     colorMap.offset.y = colorMap.offset.y % 1.0;
  //     normalMap.offset.x = normalMap.offset.x % 1.0;
  //     normalMap.offset.y = normalMap.offset.y % 1.0;
  //     aoMap.offset.x = aoMap.offset.x % 1.0;
  //     aoMap.offset.y = aoMap.offset.y % 1.0;

  //     // follow train
  //     meshRef.current.position.x = trainPos.x;
  //     meshRef.current.position.z = trainPos.z;
  //   });

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    // eslint-disable-next-line react-hooks/rules-of-hooks

    const trainPos = trainPositionRef.current;

    // move the plane
    meshRef.current.position.x = trainPos.x;
    meshRef.current.position.z = trainPos.z;

    // compute absolute texture offset from world position
    // when plane moves +X, texture must move -X by same amount
    // divided by tile world size to get UV units
    const tileWorldSize = PLANE_SIZE / TEXTURE_REPEAT; // world units per tile

    const offsetX = -(trainPos.x / tileWorldSize) % 1.0;
    const offsetZ = -(trainPos.z / tileWorldSize) % 1.0;

    // const worldToUV = TEXTURE_REPEAT / PLANE_SIZE;
    // const uOffset = -(trainPos.x * worldToUV) % 1;
    // const vOffset = -(trainPos.z * worldToUV) % 1;
    // offsetX = uOffset;
    // offsetZ = vOffset;

    colorMap.offset.set(-offsetX, offsetZ);
    normalMap.offset.set(-offsetX, offsetZ);
    aoMap.offset.set(-offsetX, offsetZ);
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    colorMap.anisotropy = maxAnisotropy;
    normalMap.anisotropy = maxAnisotropy;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, -0.15, 0]}
      receiveShadow
      renderOrder={-1}
    >
      <meshStandardMaterial
        ref={matRef}
        map={colorMap}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(1, 1)}
        aoMap={aoMap}
        aoMapIntensity={1.0}
        roughness={0.8}
        metalness={0.0}
        polygonOffset={true}
        polygonOffsetFactor={4}
        polygonOffsetUnits={4}
      />
    </mesh>
  );
}
