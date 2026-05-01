// import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { MailbagData } from "../../stores/useEntityStore";
import { GRAB_CONFIG } from "../../lib/grabConfig";
import { useEffect, useMemo, useRef, useState } from "react";

const MAILBAG_URL = "/models/mailbag.glb";

interface MailbagProps {
  mailbag: MailbagData;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function Mailbag({ mailbag, trainPositionRef }: MailbagProps) {
  const { scene } = useGLTF(MAILBAG_URL);

  const groupRef = useRef<THREE.Group>(null);
  const emissiveMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const inHighlightRef = useRef(false);
  const [inHighlightRange, setInHighlightRange] = useState(false);

  // clone scene so each mailbag is independent
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    return clone;
  }, [scene]);

  // set userData on all meshes for raycasting
  // collect emissive materials for pulse effect
  useEffect(() => {
    const mats: THREE.MeshStandardMaterial[] = [];

    clonedScene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;

      // mark for raycasting
      obj.userData.isMailbag = true;
      obj.userData.mailbagId = mailbag.id;

      // collect standard materials for emissive pulse
      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        // set emissive color -- warm yellow glow
        mat.emissive = new THREE.Color("#4a3008");
        mat.emissiveIntensity = 0;
        mats.push(mat);
      }
    });

    emissiveMatsRef.current = mats;
  }, [clonedScene, mailbag.id]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (mailbag.isExpired || mailbag.isGrabbed) {
      groupRef.current.visible = false;
      return;
    }

    const dist = trainPositionRef.current.distanceTo(mailbag.position);
    const inRange = dist < GRAB_CONFIG.HIGHLIGHT_DISTANCE;

    if (inRange !== inHighlightRef.current) {
      inHighlightRef.current = inRange;
      setInHighlightRange(inRange);
    }

    // emissive pulse on all materials when in range
    const targetEmissive = inRange
      ? GRAB_CONFIG.EMISSIVE_PULSE_MIN +
        (Math.sin(Date.now() * 0.008) * 0.5 + 0.5) *
          (GRAB_CONFIG.EMISSIVE_PULSE_MAX - GRAB_CONFIG.EMISSIVE_PULSE_MIN) *
          0.5
      : 0;

    emissiveMatsRef.current.forEach((mat) => {
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        targetEmissive,
        delta * 5,
      );
    });
  });

  if (mailbag.isGrabbed || mailbag.isExpired) return null;

  return (
    <group
      ref={groupRef}
      position={mailbag.position}
      userData={{ isMailbag: true, mailbagId: mailbag.id }}
    >
      <primitive
        object={clonedScene}
        scale={[0.65, 0.65, 0.65]} // tune to match your GLB size
      />
    </group>
  );
}

useGLTF.preload(MAILBAG_URL);
