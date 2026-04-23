/* eslint-disable react-hooks/purity */
import { useMemo } from "react";
import * as THREE from "three";

interface StarsProps {
  opacity: number; // 0 = invisible, 1 = full dusk
}

export function Stars({ opacity }: StarsProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];

    // seeded random -- same stars every time
    let seed = 12345;
    const rng = () => {
      // eslint-disable-next-line react-hooks/immutability
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < 1600; i++) {
      const theta = rng() * Math.PI * 2; // full 360 around
      const u = rng() * 0.85 + 0.15;
      const phi = rng() * Math.PI * 0.45;

      const r = 380;

      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
    }

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geo;
  }, []); // empty deps -- generated once, never changes

  //if (opacity < 0.01) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#ffffff"
        size={1.2}
        sizeAttenuation={false}
        fog={false}
        transparent
        opacity={Math.max(0, opacity)}
      />
    </points>
  );
}
