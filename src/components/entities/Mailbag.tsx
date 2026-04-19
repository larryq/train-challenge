/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MailbagData } from "../../stores/useEntityStore";
import { useEntityStore } from "../../stores/useEntityStore";
import { GRAB_CONFIG } from "../../lib/grabConfig";

interface MailbagProps {
  mailbag: MailbagData;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function Mailbag({ mailbag, trainPositionRef }: MailbagProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const lastGrabbedId = useEntityStore((s) => s.lastGrabbedClusterId);
  const [inHighlightRange, setInHighlightRange] = useState(false);
  const inHighlightRef = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || mailbag.isExpired || mailbag.isGrabbed) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    const dist = trainPositionRef.current.distanceTo(mailbag.position);
    const inRange = dist < GRAB_CONFIG.HIGHLIGHT_DISTANCE;

    if (inRange !== inHighlightRef.current) {
      inHighlightRef.current = inRange;
      setInHighlightRange(inRange);
    }

    // emissive pulse when in range
    if (matRef.current) {
      const targetEmissive = inRange
        ? GRAB_CONFIG.EMISSIVE_PULSE_MIN +
          (Math.sin(Date.now() * 0.008) * 0.5 + 0.5) *
            (GRAB_CONFIG.EMISSIVE_PULSE_MAX - GRAB_CONFIG.EMISSIVE_PULSE_MIN) *
            0.5
        : 0;

      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        matRef.current.emissiveIntensity,
        targetEmissive,
        delta * 5,
      );
    }
  });

  if (mailbag.isGrabbed || mailbag.isExpired) return null;

  return (
    <group
      ref={groupRef}
      position={mailbag.position}
      userData={{ isMailbag: true, mailbagId: mailbag.id }}
    >
      {/* main bag body */}
      <mesh userData={{ isMailbag: true, mailbagId: mailbag.id }}>
        <boxGeometry args={[0.8, 1.0, 0.6]} />
        <meshStandardMaterial
          ref={matRef}
          color="#8B6914"
          emissive="#4a3008"
          emissiveIntensity={0}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* tie at top */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#5a4010" roughness={0.9} />
      </mesh>

      {/* mail marking -- white cross on front face */}
      <mesh position={[0, 0, 0.31]}>
        <planeGeometry args={[0.3, 0.05]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[0, 0, 0.31]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.3, 0.05]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
}
