/* eslint-disable @typescript-eslint/no-unused-vars */
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SignalData } from "../../stores/useEntityStore";
import { useEntityStore } from "../../stores/useEntityStore";
// @ts-expect-error expect a complaint in shader include
import signalVert from "../../shaders/signal.vert.glsl";
// @ts-expect-error expect a complaint in shader include
import signalFrag from "../../shaders/signal.frag.glsl";
import { GRAB_CONFIG } from "../../lib/grabConfig";

interface SignalProps {
  signal: SignalData;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
}

export function Signal({ signal /*trainPositionRef*/ }: SignalProps) {
  const lightMeshRef = useRef<THREE.Mesh>(null);
  const shaderMat = useRef<THREE.ShaderMaterial | null>(null);

  // create shader material once
  useEffect(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIsGreen: { value: false },
        uPulseSpeed: { value: GRAB_CONFIG.SIGNAL_PULSE_SPEED },
      },
      vertexShader: signalVert,
      fragmentShader: signalFrag,
    });

    shaderMat.current = mat;

    if (lightMeshRef.current) {
      lightMeshRef.current.material = mat;
    }

    return () => mat.dispose();
  }, []);

  useFrame(({ clock }) => {
    if (!shaderMat.current) return;
    shaderMat.current.uniforms.uTime.value = clock.getElapsedTime();
    shaderMat.current.uniforms.uIsGreen.value = signal.isGreen;
  });

  if (signal.isExpired) return null;

  return (
    <group
      position={signal.position}
      userData={{ isSignal: true, signalId: signal.id }}
    >
      {/* post */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 3, 8]} />
        <meshLambertMaterial color="#444444" />
      </mesh>

      {/* light sphere */}
      <mesh
        ref={lightMeshRef}
        position={[0, 3.2, 0]}
        userData={{ isSignal: true, signalId: signal.id }}
      >
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshLambertMaterial color="red" />
        {/* shader applied imperatively in useEffect */}
      </mesh>

      {/* arm placeholder */}
      {/* {!signal.isGreen && (
        <mesh
          position={[signal.side === "right" ? -1.5 : 1.5, 2.8, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
          <meshLambertMaterial color="#cc4400" />
        </mesh>
      )} */}
    </group>
  );
}
