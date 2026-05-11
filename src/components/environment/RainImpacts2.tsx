import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ---- constants --------------------------------------------

const IMPACT_POOL_SIZE = 6000; // total instances -- one draw call regardless
const IMPACT_SPAWN_RADIUS = 55; // XZ radius around train
const IMPACT_LIFETIME = 0.7; // seconds per ripple lifecycle
const IMPACT_MAX_SCALE = 0.25; // world units at full expansion
const IMPACT_START_SCALE = 0.02; // world units at birth
const IMPACT_HEIGHT = 0.05; // just above terrain plane
const IMPACT_TINT = new THREE.Color("#cce8ff");

const IMPACTS_PER_SECOND = 800; // new ripples per second at full intensity

// ---- canvas ripple texture --------------------------------

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

  ctx.clearRect(0, 0, size, size);

  // outer soft halo
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

  // main ring
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

  // punch transparent hole
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

// ---- custom shader ----------------------------------------
// InstancedMesh doesn't support per-instance opacity natively.
// We encode opacity into the R channel of instanceColor and read
// it in the fragment shader to modulate alpha.
// G and B channels are unused but set to same value for consistency.

const vertexShader = /* glsl */ `
  #include <common>
  #include <uv_pars_vertex>

  varying vec2 vUv;
  varying float vOpacity;

  void main() {
    vUv = uv;

    // R channel carries per-instance opacity encoded from useFrame
    vOpacity = instanceColor.r;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTint;

  varying vec2 vUv;
  varying float vOpacity;

  void main() {
    vec4 texColor = texture2D(uMap, vUv);
    gl_FragColor = vec4(uTint * texColor.rgb, texColor.a * vOpacity);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

// ---- impact pool entry ------------------------------------

interface Impact {
  active: boolean;
  age: number;
  x: number;
  z: number;
}

// ---- component --------------------------------------------

interface RainImpactsProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  rainIntensityRef: React.MutableRefObject<number>;
}

export function RainImpacts({
  trainPositionRef,
  rainIntensityRef,
}: RainImpactsProps) {
  const { scene } = useThree();
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  const rippleTexture = useMemo(() => makeRippleTexture(), []);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2); // lay flat on ground
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: rippleTexture },
          uTint: { value: IMPACT_TINT },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [rippleTexture],
  );

  // create InstancedMesh imperatively so count is fixed at mount
  useEffect(() => {
    const mesh = new THREE.InstancedMesh(geometry, material, IMPACT_POOL_SIZE);
    mesh.name = "RainImpacts";
    mesh.frustumCulled = false;

    // must explicitly create instanceColor buffer for setColorAt to work
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(IMPACT_POOL_SIZE * 3),
      3,
    );

    // zero everything out at startup
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < IMPACT_POOL_SIZE; i++) {
      mesh.setMatrixAt(i, zeroMatrix);
      mesh.setColorAt(i, black);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;

    scene.add(mesh);
    meshRef.current = mesh;

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      rippleTexture.dispose();
    };
  }, [scene, geometry, material, rippleTexture]);

  // pure data pool -- no Three.js objects
  const pool = useRef<Impact[]>(
    Array.from({ length: IMPACT_POOL_SIZE }, () => ({
      active: false,
      age: 999,
      x: 0,
      z: 0,
    })),
  );

  const spawnAccumulator = useRef(0);
  const dummy = useRef(new THREE.Object3D());
  const colorScratch = useRef(new THREE.Color());

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const safeDelta = Math.min(delta, 0.05);
    const intensity = rainIntensityRef.current;
    const trainPos = trainPositionRef.current;

    // ---- spawn -------------------------------------------
    if (intensity > 0) {
      spawnAccumulator.current += IMPACTS_PER_SECOND * intensity * safeDelta;

      while (spawnAccumulator.current >= 1) {
        spawnAccumulator.current -= 1;

        // linear scan for free slot -- fast enough at this pool size
        for (let i = 0; i < IMPACT_POOL_SIZE; i++) {
          if (!pool.current[i].active) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * IMPACT_SPAWN_RADIUS;
            pool.current[i].x = trainPos.x + Math.cos(angle) * radius;
            pool.current[i].z = trainPos.z + Math.sin(angle) * radius;
            pool.current[i].age = 0;
            pool.current[i].active = true;
            break;
          }
        }
      }
    }

    // ---- update all instances ----------------------------
    let matrixDirty = false;
    let colorDirty = false;

    for (let i = 0; i < IMPACT_POOL_SIZE; i++) {
      const impact = pool.current[i];
      if (!impact.active) continue;

      impact.age += safeDelta;

      if (impact.age >= IMPACT_LIFETIME) {
        // expire -- hide with zero scale
        impact.active = false;
        dummy.current.position.set(0, 0, 0);
        dummy.current.scale.setScalar(0);
        dummy.current.updateMatrix();
        mesh.setMatrixAt(i, dummy.current.matrix);
        colorScratch.current.setRGB(0, 0, 0);
        mesh.setColorAt(i, colorScratch.current);
        matrixDirty = true;
        colorDirty = true;
        continue;
      }

      const t = impact.age / IMPACT_LIFETIME;

      // cubic ease out scale expansion
      const eased = 1 - Math.pow(1 - t, 3);
      const scale =
        IMPACT_START_SCALE + eased * (IMPACT_MAX_SCALE - IMPACT_START_SCALE);

      // fast fade in, hold, fade out
      let opacity: number;
      if (t < 0.15) {
        opacity = t / 0.15;
      } else if (t < 0.6) {
        opacity = 1.0;
      } else {
        opacity = 1.0 - (t - 0.6) / 0.4;
      }
      opacity *= intensity * 0.7;

      dummy.current.position.set(impact.x, IMPACT_HEIGHT, impact.z);
      dummy.current.scale.setScalar(scale);
      dummy.current.rotation.set(0, 0, 0);
      dummy.current.updateMatrix();
      mesh.setMatrixAt(i, dummy.current.matrix);

      // encode opacity in R channel -- shader reads instanceColor.r
      colorScratch.current.setRGB(opacity, opacity, opacity);
      mesh.setColorAt(i, colorScratch.current);

      matrixDirty = true;
      colorDirty = true;
    }

    if (matrixDirty) mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return null;
}
