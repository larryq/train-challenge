import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RainImpacts } from "./RainImpacts";

// ---- constants --------------------------------------------

const RAIN_PARTICLE_COUNT = 8500;

const RAIN_VOLUME_WIDTH = 80; // XZ extent of rain box around train
const RAIN_VOLUME_HEIGHT = 60; // vertical extent
const RAIN_FALL_SPEED = 55; // units per second downward
const RAIN_WIND_X = 4; // units per second horizontal drift
const RAIN_WIND_Z = 1; // slight Z drift too

const RAIN_MIN_IDLE = 5; // seconds before rain can trigger
const RAIN_MAX_IDLE = 20; // seconds maximum idle
const RAIN_MIN_DURATION = 20; // seconds rain lasts minimum
const RAIN_MAX_DURATION = 60; // seconds rain lasts maximum

const RAIN_FADE_IN = 3; // seconds to fade in
const RAIN_FADE_OUT = 4; // seconds to fade out

const RAIN_OPACITY = 0.55; // peak opacity when fully raining
const RAIN_COLOR = "#aabbcc"; // slight blue-grey

// ---- weather state machine --------------------------------
// idle -> starting -> raining -> stopping -> idle

type WeatherState = "idle" | "starting" | "raining" | "stopping";

// ---- component --------------------------------------------

interface RainSystemProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  rainIntensityRef: React.MutableRefObject<number>;
}

export function RainSystem({
  trainPositionRef,
  rainIntensityRef,
}: RainSystemProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  // weather state
  const weatherState = useRef<WeatherState>("idle");
  // eslint-disable-next-line react-hooks/purity
  const stateStartTime = useRef(Date.now());
  const nextIdleDuration = useRef(
    randomBetween(RAIN_MIN_IDLE, RAIN_MAX_IDLE) * 1000,
  );

  // particle positions buffer -- flat Float32Array [x,y,z, x,y,z, ...]
  const positions = useMemo(() => {
    const arr = new Float32Array(RAIN_PARTICLE_COUNT * 3);
    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      arr[i * 3 + 0] = randomBetween(
        -RAIN_VOLUME_WIDTH / 2,
        RAIN_VOLUME_WIDTH / 2,
      );
      arr[i * 3 + 1] = randomBetween(0, RAIN_VOLUME_HEIGHT);
      arr[i * 3 + 2] = randomBetween(
        -RAIN_VOLUME_WIDTH / 2,
        RAIN_VOLUME_WIDTH / 2,
      );
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !materialRef.current) return;

    const now = Date.now();
    const elapsed = (now - stateStartTime.current) / 1000; // seconds
    const mat = materialRef.current;

    // ---- state machine ------------------------------------
    switch (weatherState.current) {
      case "idle":
        mat.opacity = 0;
        if (elapsed > nextIdleDuration.current / 1000) {
          // eslint-disable-next-line react-hooks/immutability
          transitionTo("starting", now);
        }
        break;

      case "starting":
        mat.opacity = Math.min(elapsed / RAIN_FADE_IN, 1) * RAIN_OPACITY;
        if (elapsed >= RAIN_FADE_IN) {
          transitionTo("raining", now);
        }
        break;

      case "raining": {
        mat.opacity = RAIN_OPACITY;
        const rainDuration = randomBetween(
          RAIN_MIN_DURATION,
          RAIN_MAX_DURATION,
        );
        if (elapsed >= rainDuration) {
          transitionTo("stopping", now);
        }
        break;
      }

      case "stopping":
        mat.opacity = Math.max(0, 1 - elapsed / RAIN_FADE_OUT) * RAIN_OPACITY;
        if (elapsed >= RAIN_FADE_OUT) {
          nextIdleDuration.current =
            randomBetween(RAIN_MIN_IDLE, RAIN_MAX_IDLE) * 1000;
          transitionTo("idle", now);
        }
        break;
    }

    rainIntensityRef.current = mat.opacity / RAIN_OPACITY;

    // skip particle updates when not visible
    if (mat.opacity === 0) return;

    // ---- move rain volume with train ---------------------
    const trainPos = trainPositionRef.current;
    pointsRef.current.position.x = trainPos.x;
    pointsRef.current.position.z = trainPos.z + 0;

    // ---- update particle positions ----------------------
    const safeDelta = Math.min(delta, 0.05);
    const fallAmount = RAIN_FALL_SPEED * safeDelta;
    const windX = RAIN_WIND_X * safeDelta;
    const windZ = RAIN_WIND_Z * safeDelta;

    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      const idx = i * 3;

      // eslint-disable-next-line react-hooks/immutability
      positions[idx + 0] += windX;
      positions[idx + 1] -= fallAmount;
      positions[idx + 2] += windZ;

      // wrap back to top when particle hits ground
      if (positions[idx + 1] < 0) {
        positions[idx + 0] = randomBetween(
          -RAIN_VOLUME_WIDTH / 2,
          RAIN_VOLUME_WIDTH / 2,
        );
        positions[idx + 1] = RAIN_VOLUME_HEIGHT;
        positions[idx + 2] = randomBetween(
          -RAIN_VOLUME_WIDTH / 2,
          RAIN_VOLUME_WIDTH / 2,
        );
      }

      // wrap X if wind carries particles out of volume
      if (positions[idx + 0] > RAIN_VOLUME_WIDTH / 2)
        positions[idx + 0] = -RAIN_VOLUME_WIDTH / 2;
      if (positions[idx + 0] < -RAIN_VOLUME_WIDTH / 2)
        positions[idx + 0] = RAIN_VOLUME_WIDTH / 2;
    }

    // tell Three.js the buffer changed this frame
    const geo = pointsRef.current.geometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  function transitionTo(next: WeatherState, now: number) {
    weatherState.current = next;
    stateStartTime.current = now;
  }

  function makeCircleTexture(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }
  const circleTexture = useMemo(() => makeCircleTexture(), []);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        color={RAIN_COLOR}
        size={0.15}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        fog={true}
        map={circleTexture}
        alphaTest={0.5}
      />
    </points>
  );
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
