import { useRef, useMemo, type JSX, useEffect } from "react";
import { useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
// @ts-expect-error expect a complaint in shader include
import terrainVert from "../../shaders/terrain.vert.glsl";
// @ts-expect-error expect a complaint in shader include
import terrainFrag from "../../shaders/terrain.frag.glsl";
import { useDayNight } from "../../hooks/useDayNight";

//current grass and soil colors, prior to adding night / day code

// uColorSoil: new THREE.Color("#9f8264"), // was #5c3d1e -- brighter
// uColorGrassLow: new THREE.Color("#3d7a25"), // was #2d5a1b -- more saturated
// uColorGrassMid: new THREE.Color("#5a9a4a"), // was #4a7c3f -- brighter
// uColorGrassDry: new THREE.Color("#9aaa5a"), // was #8a9a3f -- warmer

// create the shader material
const TerrainMaterial = shaderMaterial(
  {
    uTrainPosition: new THREE.Vector3(),
    // uColorSoil: new THREE.Color("#7b6044"),
    // uColorGrassLow: new THREE.Color("#558e3e"),
    // uColorGrassMid: new THREE.Color("#4a7c3f"),
    // uColorGrassDry: new THREE.Color("#8a9a3f"),
    uColorSoil: new THREE.Color("#9f8264"), // was #5c3d1e -- brighter
    uColorGrassLow: new THREE.Color("#3d7a25"), // was #2d5a1b -- more saturated
    uColorGrassMid: new THREE.Color("#5a9a4a"), // was #4a7c3f -- brighter
    uColorGrassDry: new THREE.Color("#9aaa5a"), // was #8a9a3f -- warmer
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
  cycleValue: number;
}

export function Terrain({ trainPositionRef, cycleValue }: TerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // high subdivision count for smooth displacement
  // 128x128 gives good detail, 256x256 if you want more
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(600, 600, 16, 16);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  // useEffect(() => {
  //   if (!materialRef.current) return;
  //   const t = cycleValue;

  //   // lerp terrain colors toward dusk palette
  //   materialRef.current.uniforms.uColorSoil.value.lerpColors(
  //     new THREE.Color("#5c3d1e"), // day soil
  //     new THREE.Color("#3d2a1a"), // dusk soil
  //     t,
  //   );
  //   materialRef.current.uniforms.uColorGrassLow.value.lerpColors(
  //     new THREE.Color("#2d5a1b"), // day grass low
  //     new THREE.Color("#1a3a12"), // dusk grass low
  //     t,
  //   );
  //   materialRef.current.uniforms.uColorGrassMid.value.lerpColors(
  //     new THREE.Color("#4a7c3f"), // day grass mid
  //     new THREE.Color("#2a4a28"), // dusk grass mid
  //     t,
  //   );
  //   materialRef.current.uniforms.uColorGrassDry.value.lerpColors(
  //     new THREE.Color("#8a9a3f"), // day grass dry
  //     new THREE.Color("#4a5a2a"), // dusk grass dry
  //     t,
  //   );
  // }, [cycleValue]);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return;

    const trainPos = trainPositionRef.current;

    // follow train on XZ
    meshRef.current.position.x = trainPos.x;
    meshRef.current.position.z = trainPos.z;

    // update shader uniform so noise stays world-anchored
    materialRef.current.uniforms.uTrainPosition.value.copy(trainPos);

    const t = cycleValue;

    // lerp terrain colors toward dusk palette
    materialRef.current.uniforms.uColorSoil.value.lerpColors(
      new THREE.Color("#5c3d1e"), // day soil
      new THREE.Color("#3d2a1a"), // dusk soil
      t,
    );
    materialRef.current.uniforms.uColorGrassLow.value.lerpColors(
      new THREE.Color("#2d5a1b"), // day grass low
      new THREE.Color("#1a3a12"), // dusk grass low
      t,
    );
    materialRef.current.uniforms.uColorGrassMid.value.lerpColors(
      new THREE.Color("#4a7c3f"), // day grass mid
      new THREE.Color("#2a4a28"), // dusk grass mid
      t,
    );
    materialRef.current.uniforms.uColorGrassDry.value.lerpColors(
      new THREE.Color("#8a9a3f"), // day grass dry
      new THREE.Color("#4a5a2a"), // dusk grass dry
      t,
    );
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[0, -0.5, 0]}
      receiveShadow
      renderOrder={-1}
    >
      {/* @ts-expect-error -- custom material */}
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
