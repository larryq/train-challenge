/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRef, useState, useMemo, useCallback, useEffect } from "react";

import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { RubyClusterData } from "../../stores/useEntityStore";
import { useEntityStore } from "../../stores/useEntityStore";
import { GRAB_CONFIG } from "../../lib/grabConfig";

// ---- Ruby ------------------------------------------------

interface RubyProps {
  position: [number, number, number];
  phaseOffset: number;
  spinSpeed: number;
  isGrabbed: boolean;
  inHighlightRange: boolean;
  rubyIndex: 0 | 1 | 2;
}

function Ruby({
  position,
  phaseOffset,
  spinSpeed,
  isGrabbed,
  inHighlightRange,
  rubyIndex,
}: RubyProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || !matRef.current) return;
    if (isGrabbed) {
      meshRef.current.visible = false;
      return;
    }

    const t = clock.elapsedTime;

    // bob
    meshRef.current.position.y =
      position[1] +
      Math.sin(t * GRAB_CONFIG.RUBY_BOB_SPEED + phaseOffset) *
        GRAB_CONFIG.RUBY_BOB_AMPLITUDE;

    // spin
    meshRef.current.rotation.y += spinSpeed;

    // highlight feedback
    if (inHighlightRange) {
      const targetEmissive =
        GRAB_CONFIG.EMISSIVE_PULSE_MIN +
        (Math.sin(t * GRAB_CONFIG.EMISSIVE_PULSE_SPEED) * 0.5 + 0.5) *
          (GRAB_CONFIG.EMISSIVE_PULSE_MAX - GRAB_CONFIG.EMISSIVE_PULSE_MIN);

      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        matRef.current.emissiveIntensity,
        targetEmissive,
        delta * 5,
      );

      const shimmy =
        1 + Math.sin(t * GRAB_CONFIG.SHIMMY_SPEED) * GRAB_CONFIG.SHIMMY_AMOUNT;
      meshRef.current.scale.setScalar(shimmy);
    } else {
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        matRef.current.emissiveIntensity,
        GRAB_CONFIG.EMISSIVE_BASE,
        delta * 5,
      );
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, 1, delta * 5),
      );
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      userData={{ isRuby: true, rubyIndex }}
    >
      <octahedronGeometry args={[0.25]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ff2244"
        emissive="#ff0000"
        emissiveIntensity={GRAB_CONFIG.EMISSIVE_BASE}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}

// ---- RubyCluster -----------------------------------------

interface RubyClusterProps {
  cluster: RubyClusterData;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function RubyCluster({ cluster, trainPositionRef }: RubyClusterProps) {
  const groupRef = useRef<THREE.Group>(null);

  const [inHighlightRange, setInHighlightRange] = useState(false);
  const [showSparkle, setShowSparkle] = useState(false);
  const lastGrabbedId = useEntityStore((s) => s.lastGrabbedClusterId);

  const inHighlightRef = useRef(false);

  const phases = useMemo(() => [0, Math.PI * 0.66, Math.PI * 1.33], []);

  const spinSpeeds = useMemo(
    () => [
      GRAB_CONFIG.RUBY_SPIN_SPEED_BASE,
      GRAB_CONFIG.RUBY_SPIN_SPEED_BASE * 1.25,
      GRAB_CONFIG.RUBY_SPIN_SPEED_BASE * 0.8,
    ],
    [],
  );

  useFrame(() => {
    if (!groupRef.current || cluster.isExpired) return;

    // highlight range check
    const dist = trainPositionRef.current.distanceTo(cluster.position);
    const inRange = dist < GRAB_CONFIG.HIGHLIGHT_DISTANCE;
    if (inRange !== inHighlightRef.current) {
      inHighlightRef.current = inRange;
      setInHighlightRange(inRange);
    }

    // group Z spin
    if (GRAB_CONFIG.GROUP_SPIN_FACTOR > 0) {
      groupRef.current.rotation.z += GRAB_CONFIG.GROUP_SPIN_FACTOR * 0.01;
    }
  });

  useEffect(() => {
    console.log(
      "lastGrabbedId changed to:",
      lastGrabbedId,
      "my id:",
      cluster.id,
    );
    if (lastGrabbedId === cluster.id) {
      setShowSparkle(true);
      setTimeout(() => setShowSparkle(false), 1200);
    }
  }, [lastGrabbedId, cluster.id]);

  if (cluster.isExpired && cluster.rubiesGrabbed.every(Boolean)) {
    return null;
  }

  const spacing = GRAB_CONFIG.RUBY_VERTICAL_SPACING;

  return (
    <group
      ref={groupRef}
      position={cluster.position}
      userData={{ clusterId: cluster.id }}
    >
      {([0, 1, 2] as const).map((i) => (
        <Ruby
          key={i}
          position={[0, i * spacing, 0]}
          phaseOffset={phases[i]}
          spinSpeed={spinSpeeds[i]}
          isGrabbed={cluster.rubiesGrabbed[i]}
          inHighlightRange={inHighlightRange}
          rubyIndex={i}
        />
      ))}

      {showSparkle && (
        <Sparkles
          position={[0, spacing, 0]}
          count={GRAB_CONFIG.SPARKLE_COUNT}
          scale={0.7} // wider spread
          size={GRAB_CONFIG.SPARKLE_SIZE}
          speed={GRAB_CONFIG.SPARKLE_SPEED}
          color={GRAB_CONFIG.SPARKLE_COLOR}
          opacity={1} // full opacity
          noise={1} // adds variation to movement
        />
      )}
    </group>
  );
}
