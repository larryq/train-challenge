import { useRef, useMemo, type JSX } from "react";
import { useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
// @ts-expect-error expect a complaint in shader include
import terrainVert from "../../shaders/terrain.vert.glsl";
// @ts-expect-error expect a complaint in shader include
import terrainFrag from "../../shaders/terrain.frag.glsl";

// create the shader material
const TerrainMaterial = shaderMaterial(
  {
    uTrainPosition: new THREE.Vector3(),
    uColorSoil: new THREE.Color("#7b6044"),
    uColorGrassLow: new THREE.Color("#2d5a1b"),
    uColorGrassMid: new THREE.Color("#4a7c3f"),
    uColorGrassDry: new THREE.Color("#8a9a3f"),
    fogColor: new THREE.Color("#c8a882"),
    uNoiseOffset: new THREE.Vector2(0, 0),
    fogDensity: 0.018,
    fogNear: 1,
    fogFar: 1000,

    // uCameraPosition: new THREE.Vector3(),
  },
  terrainVert,
  terrainFrag,
);

extend({ TerrainMaterial });

// TypeScript declaration for JSX
declare module "@react-three/fiber" {
  interface ThreeElements {
    terrainMaterial: JSX.IntrinsicElements["primitive"] & {
      uTrainPosition?: THREE.Vector3;
      uColorSoil?: THREE.Color;
      uColorGrassLow?: THREE.Color;
      uColorGrassMid?: THREE.Color;
      uColorGrassDry?: THREE.Color;
      uNoiseOffset: THREE.Vector2;
    };
  }
}

interface TerrainProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function Terrain({ trainPositionRef }: TerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // high subdivision count for smooth displacement
  // 128x128 gives good detail, 256x256 if you want more
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(600, 600, 16, 16);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return;

    const trainPos = trainPositionRef.current;

    // follow train on XZ
    meshRef.current.position.x = trainPos.x;
    meshRef.current.position.z = trainPos.z;

    // update shader uniform so noise stays world-anchored
    materialRef.current.uniforms.uTrainPosition.value.copy(trainPos);
    //materialRef.current.uniforms.uCameraPosition.value.copy(camera.position);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, -0.5, 0]}
      receiveShadow
      renderOrder={-1}
    >
      {/* @ts-ignore -- custom material */}
      <terrainMaterial
        ref={materialRef}
        fog={true}
        uTrainPosition={new THREE.Vector3()}
        uColorSoil={new THREE.Color("#8b6e52")}
        uColorGrassLow={new THREE.Color("#2d5a1b")}
        uColorGrassMid={new THREE.Color("#4a7c3f")}
        uColorGrassDry={new THREE.Color("#8a9a3f")}
        uNoiseOffset={new THREE.Vector2(0, 0)}
        polygonOffset={true}
        polygonOffsetFactor={4}
        polygonOffsetUnits={4}
      />
    </mesh>
  );
}
