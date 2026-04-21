/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky, Cloud, Clouds } from "@react-three/drei";
import { DistantHills } from "./DistantHills";
import * as THREE from "three";

const SUN_POSITION: [number, number, number] = [100, 30, -400];

interface CloudData {
  id: number;
  position: [number, number, number];
  scale: number;
  speed: number;
  opacity: number;
}

interface EnvironmentProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

const CLOUD_CONFIG: CloudData[] = [
  { id: 0, position: [-80, 45, -200], scale: 1.5, speed: 0.4, opacity: 0.8 },
  { id: 1, position: [60, 55, -350], scale: 2.0, speed: 0.3, opacity: 0.6 },
  { id: 2, position: [-40, 50, -500], scale: 1.2, speed: 0.5, opacity: 0.7 },
  { id: 3, position: [120, 40, -300], scale: 1.8, speed: 0.2, opacity: 0.9 },
  { id: 4, position: [-100, 60, -150], scale: 1.0, speed: 0.35, opacity: 0.5 },
  { id: 5, position: [80, 50, -450], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 6, position: [-80, 55, -150], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 7, position: [70, 66, -450], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 8, position: [40, 82, -50], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 9, position: [44, 81, 45], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 10, position: [120, 50, 125], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 11, position: [45, 50, -10], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 12, position: [-150, 39, -125], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 13, position: [-400, 50, -125], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 15, position: [-330, 40, -200], scale: 1.6, speed: 0.25, opacity: 0.7 },
  { id: 16, position: [-190, 50, -300], scale: 1.6, speed: 0.25, opacity: 0.7 },
  // { id: 17, position: [80, 50, -450], scale: 1.6, speed: 0.25, opacity: 0.7 },
  // { id: 18, position: [80, 50, -450], scale: 1.6, speed: 0.25, opacity: 0.7 },
  // { id: 19, position: [80, 50, -450], scale: 1.6, speed: 0.25, opacity: 0.7 },
];

function SunSystem({
  trainPositionRef,
}: {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const sunRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.position.x = trainPositionRef.current.x + SUN_POSITION[0];
      sunRef.current.position.y = SUN_POSITION[1];
      sunRef.current.position.z = trainPositionRef.current.z + SUN_POSITION[2];
    }
  });

  return (
    <mesh position={SUN_POSITION} ref={sunRef}>
      <sphereGeometry args={[8, 16, 16]} />
      <meshBasicMaterial color="#fffabb" fog={false} />
    </mesh>
  );
}

function CloudSystem({
  trainPositionRef,
}: {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cloudRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    // follow train on XZ so clouds are always around us
    if (groupRef.current) {
      groupRef.current.position.x = trainPositionRef.current.x;
      groupRef.current.position.z = trainPositionRef.current.z;
    }

    // drift each cloud independently
    cloudRefs.current.forEach((cloud, i) => {
      if (!cloud) return;
      cloud.position.x += delta * CLOUD_CONFIG[i].speed;
      if (cloud.position.x > 250) cloud.position.x = -250;
    });
  });

  return (
    <group ref={groupRef}>
      <Clouds>
        {CLOUD_CONFIG.map((config, i) => (
          <Cloud
            key={config.id}
            ref={(el: any) => {
              cloudRefs.current[i] = el;
            }}
            position={config.position}
            scale={config.scale}
            opacity={config.opacity}
            color="#ffddbb"
            speed={0.1}
            segments={20}
          />
        ))}
      </Clouds>
    </group>
  );
}

export function Environment({ trainPositionRef }: EnvironmentProps) {
  return (
    <>
      {/* physically based sky */}
      <Sky
        distance={450000}
        sunPosition={SUN_POSITION}
        inclination={0.48}
        azimuth={0.25}
        turbidity={8}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* sun mesh -- sits in front of sky */}
      <SunSystem trainPositionRef={trainPositionRef} />

      {/* late afternoon warm lighting */}
      <directionalLight
        position={SUN_POSITION}
        intensity={2.2}
        color="#ffb347"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      <ambientLight intensity={0.4} color="#ffcc88" />

      {/* sky/ground bounce */}
      <hemisphereLight args={["#ffaa44", "#4a6644", 0.5]} />

      {/* warm atmospheric haze */}

      <fogExp2 attach="fog" args={["#c8a882", 0.022]} />
      <fogExp2 attach="fog" args={["#c8a882", 0.022]} />

      {/* drifting clouds */}
      <CloudSystem trainPositionRef={trainPositionRef} />
      <DistantHills trainPositionRef={trainPositionRef} />
    </>
  );
}
