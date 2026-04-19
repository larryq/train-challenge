import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  generateHillGeometry,
  generateHillRingConfigs,
  type HillRingConfig,
} from "../../lib/hillUtils";

const HILL_COUNT = 20;
const RING_RADIUS = 250;
const MASTER_SEED = 42;

// drift rates -- tune these to taste
const LATERAL_DRIFT_RATE = 0.002; // from X movement
const FORWARD_DRIFT_RATE = 0.0005; // from Z movement

interface DistantHillMeshProps {
  config: HillRingConfig;
  position: THREE.Vector3;
}

function DistantHillMesh({ config, position }: DistantHillMeshProps) {
  const geometry = useMemo(
    () =>
      generateHillGeometry({
        height: config.height,
        radius: config.radius,
        radialSegments: 8,
        seed: config.seed,
        lean: config.lean,
        noiseStrength: 0.2,
      }),
    [config],
  );

  return (
    <mesh geometry={geometry} position={position}>
      <meshBasicMaterial vertexColors={true} fog={true} />
    </mesh>
  );
}

interface DistantHillsProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function DistantHills({ trainPositionRef }: DistantHillsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hillMeshRefs = useRef<(THREE.Mesh | null)[]>([]);

  // generate hill configs once -- same hills every time
  const hillConfigs = useMemo(
    () => generateHillRingConfigs(HILL_COUNT, MASTER_SEED),
    [],
  );

  // generate geometries once
  const geometries = useMemo(
    () =>
      hillConfigs.map((config) =>
        generateHillGeometry({
          height: config.height,
          radius: config.radius,
          radialSegments: 8,
          seed: config.seed,
          lean: config.lean,
          noiseStrength: 0.2,
        }),
      ),
    [hillConfigs],
  );

  // drift tracking
  const ringRotationRef = useRef(0);
  const lastTrainPosRef = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!groupRef.current) return;

    const trainPos = trainPositionRef.current;
    const last = lastTrainPosRef.current;

    // movement delta this frame
    const dx = trainPos.x - last.x;
    const dz = trainPos.z - last.z;
    lastTrainPosRef.current.copy(trainPos);

    // accumulate ring rotation from movement
    ringRotationRef.current +=
      dx * LATERAL_DRIFT_RATE + dz * FORWARD_DRIFT_RATE;

    // update each hill position
    hillMeshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;

      const config = hillConfigs[i];
      const baseAngle = (i / HILL_COUNT) * Math.PI * 2;
      const angle = baseAngle + config.angleOffset + ringRotationRef.current;

      mesh.position.x = trainPos.x + Math.cos(angle) * RING_RADIUS;
      mesh.position.y = -2; // sit at ground level
      mesh.position.z = trainPos.z + Math.sin(angle) * RING_RADIUS;
    });
  });

  return (
    <group ref={groupRef}>
      {hillConfigs.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            hillMeshRefs.current[i] = el;
          }}
          geometry={geometries[i]}
        >
          <meshBasicMaterial
            vertexColors={true}
            fog={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
