import { Cloud } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PUFF_COUNT = 5;
const RISE_SPEED = 0.8; // units per second upward
const DRIFT_BACK = 1.4; // units per second backward
const MAX_HEIGHT = 1.8; // height before recycling
const CHIMNEY_TIP = new THREE.Vector3(0, 2.2, 0.8); // tune to match chimney position

interface Puff {
  offset: number; // 0-1 phase offset so puffs are staggered
}

const PUFFS: Puff[] = Array.from({ length: PUFF_COUNT }, (_, i) => ({
  offset: i / PUFF_COUNT,
}));

export function ChimneySmoke() {
  const puffRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.05);

    puffRefs.current.forEach((puff, i) => {
      if (!puff) return;

      // move upward and backward
      puff.position.y += RISE_SPEED * safeDelta;
      puff.position.z -= DRIFT_BACK * safeDelta;

      // slight sideways wobble
      puff.position.x += Math.sin(Date.now() * 0.001 + i) * 0.005;

      // recycle when too high
      if (puff.position.y > CHIMNEY_TIP.y + MAX_HEIGHT) {
        puff.position.copy(CHIMNEY_TIP);
        // slight random offset on recycle so puffs don't stack
        puff.position.x += (Math.random() - 0.5) * 0.3;
      }
    });
  });

  return (
    <>
      {PUFFS.map((puff, i) => {
        // stagger initial positions along the rise path
        const startY = CHIMNEY_TIP.y + puff.offset * MAX_HEIGHT;

        return (
          <group
            key={i}
            ref={(el) => {
              puffRefs.current[i] = el;
            }}
            position={[
              // eslint-disable-next-line react-hooks/purity
              CHIMNEY_TIP.x + (Math.random() - 0.5) * 0.2,
              startY,
              CHIMNEY_TIP.z -
                puff.offset * DRIFT_BACK * (MAX_HEIGHT / RISE_SPEED),
            ]}
          >
            <Cloud
              segments={4}
              bounds={[0.3, 0.2, 0.3]}
              volume={0.3}
              color="#aaaaaa"
              fade={0.5}
              speed={0} // no internal animation
              opacity={0.08}
            />
          </group>
        );
      })}
    </>
  );
}
