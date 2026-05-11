import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---- constants --------------------------------------------

const IMPACT_POOL_SIZE = 580; // number of simultaneous ripples
const IMPACT_SPAWN_RADIUS = 55; // XZ radius around train to scatter impacts
const IMPACT_LIFETIME = 0.7; // seconds per ripple lifecycle
const IMPACT_MAX_SCALE = 0.25; // world units at full expansion
const IMPACT_START_SCALE = 0.05; // world units at birth
const IMPACT_HEIGHT = 0.05; // just above terrain plane
const IMPACT_TINT = "#cce8ff"; // slight cool blue-white

// how many new impacts to spawn per second -- scales with rain intensity
const IMPACTS_PER_SECOND = 280;

// ---- canvas texture ---------------------------------------

function makeRippleTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.45;
  const ringThickness = size * 0.09;
  const innerRadius = outerRadius - ringThickness;

  // clear to transparent
  ctx.clearRect(0, 0, size, size);

  // outer soft falloff -- wide faint halo
  const outerGlow = ctx.createRadialGradient(
    cx,
    cy,
    innerRadius * 0.85,
    cx,
    cy,
    outerRadius * 1.15,
  );
  outerGlow.addColorStop(0, "rgba(255,255,255,0.0)");
  outerGlow.addColorStop(0.3, "rgba(255,255,255,0.25)");
  outerGlow.addColorStop(0.6, "rgba(255,255,255,0.15)");
  outerGlow.addColorStop(1, "rgba(255,255,255,0.0)");

  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius * 1.15, 0, Math.PI * 2);
  ctx.fillStyle = outerGlow;
  ctx.fill();

  // main ring -- bright core with soft edges
  const ringGradient = ctx.createRadialGradient(
    cx,
    cy,
    innerRadius * 0.9,
    cx,
    cy,
    outerRadius,
  );
  ringGradient.addColorStop(0, "rgba(255,255,255,0.0)");
  ringGradient.addColorStop(0.2, "rgba(255,255,255,0.9)");
  ringGradient.addColorStop(0.5, "rgba(255,255,255,1.0)");
  ringGradient.addColorStop(0.8, "rgba(255,255,255,0.8)");
  ringGradient.addColorStop(1, "rgba(255,255,255,0.0)");

  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = ringGradient;
  ctx.fill();

  // punch transparent hole in the center
  ctx.globalCompositeOperation = "destination-out";
  const holeGradient = ctx.createRadialGradient(
    cx,
    cy,
    0,
    cx,
    cy,
    innerRadius * 0.88,
  );
  holeGradient.addColorStop(0, "rgba(0,0,0,1.0)");
  holeGradient.addColorStop(0.7, "rgba(0,0,0,1.0)");
  holeGradient.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius * 0.88, 0, Math.PI * 2);
  ctx.fillStyle = holeGradient;
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ---- impact pool entry ------------------------------------

interface Impact {
  age: number; // seconds since spawn
  x: number; // world X
  z: number; // world Z
  active: boolean;
  raindropIndex: number; // which raindrop mesh in the pool this maps to
}

// ---- component --------------------------------------------

interface RainImpactsProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  // 0 = no rain, 1 = full rain -- driven by RainSystem
  rainIntensityRef: React.MutableRefObject<number>;
}

export function RainImpacts({
  trainPositionRef,
  rainIntensityRef,
}: RainImpactsProps) {
  const groupRef = useRef<THREE.Group>(null);
  // const spritesRef = useRef<THREE.Sprite[]>([]);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  const rippleTexture = useMemo(() => makeRippleTexture(), []);

  // // shared material -- all sprites use the same one
  // const material = useMemo(
  //   () =>
  //     new THREE.SpriteMaterial({
  //       map: rippleTexture,
  //       color: new THREE.Color(IMPACT_TINT),
  //       transparent: true,
  //       opacity: 0,
  //       depthWrite: false,
  //       blending: THREE.AdditiveBlending,
  //       fog: false,
  //     }),
  //   [rippleTexture],
  // );

  // impact pool -- pure data, no Three.js objects
  const pool = useRef<Impact[]>(
    Array.from({ length: IMPACT_POOL_SIZE }, (_, i) => ({
      age: 999, // start expired so they get recycled immediately
      x: 0,
      z: 0,
      active: false,
      raindropIndex: i,
    })),
  );

  const spawnAccumulator = useRef(0); // fractional impacts waiting to spawn

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const safeDelta = Math.min(delta, 0.05);
    const intensity = rainIntensityRef.current;
    const trainPos = trainPositionRef.current;

    // ---- accumulate and spawn new impacts -----------------
    if (intensity > 0) {
      spawnAccumulator.current += IMPACTS_PER_SECOND * intensity * safeDelta;

      while (spawnAccumulator.current >= 1) {
        spawnAccumulator.current -= 1;

        // find an expired impact to recycle
        const slot = pool.current.find((p) => !p.active);
        if (slot) {
          // random XZ within spawn radius
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * IMPACT_SPAWN_RADIUS;
          slot.x = trainPos.x + Math.cos(angle) * radius;
          slot.z = trainPos.z + Math.sin(angle) * radius;
          slot.age = 0;
          slot.active = true;
        }
      }
    }

    // ---- update all active impacts -----------------------
    pool.current.forEach((impact) => {
      const raindrop = meshesRef.current[impact.raindropIndex];
      if (!raindrop) return;

      if (!impact.active) {
        raindrop.visible = false;
        return;
      }

      impact.age += safeDelta;

      if (impact.age >= IMPACT_LIFETIME) {
        impact.active = false;
        raindrop.visible = false;
        return;
      }

      const t = impact.age / IMPACT_LIFETIME; // 0 -> 1 over lifetime

      // scale: expand from small to full size
      // cubic ease out -- fast expansion early, slows toward end
      const eased = 1 - Math.pow(1 - t, 3);
      const scale =
        IMPACT_START_SCALE + eased * (IMPACT_MAX_SCALE - IMPACT_START_SCALE);

      // opacity: fade in fast, hold, then fade out
      // peak at t=0.15, hold until t=0.6, fade out by t=1.0
      let opacity: number;
      if (t < 0.15) {
        opacity = t / 0.15;
      } else if (t < 0.6) {
        opacity = 1.0;
      } else {
        opacity = 1.0 - (t - 0.6) / 0.4;
      }

      // modulate by rain intensity so impacts fade with rain
      opacity *= intensity * 0.7; // 0.7 keeps them subtle

      raindrop.visible = true;
      raindrop.position.set(impact.x, IMPACT_HEIGHT, impact.z);
      raindrop.scale.set(scale, scale, scale);

      const mat = raindrop.material as THREE.MeshStandardMaterial;
      mat.opacity = opacity;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: IMPACT_POOL_SIZE }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (el) meshesRef.current[i] = el as any;
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]} // flat on ground
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={rippleTexture}
            color={IMPACT_TINT}
            transparent
            opacity={100}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
