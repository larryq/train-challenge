import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ---- style selector ---------------------------------------
// switch between "distorted" and "concentric" to compare looks

const IMPACT_STYLE: "distorted" | "concentric" = "distorted";

// ---- constants --------------------------------------------

const IMPACT_POOL_SIZE = 6000;
const IMPACT_SPAWN_RADIUS = 55;
const IMPACT_LIFETIME = 0.7; // seconds
const IMPACT_MAX_SCALE = 0.25; // world units at full size
const IMPACT_START_SCALE = 0.02;
const IMPACT_HEIGHT = 0.05;
const IMPACT_TINT = new THREE.Color("#cce8ff");
const IMPACTS_PER_SECOND = 800;

// ---- shaders ----------------------------------------------

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vOpacity;
  varying float vT;        // normalised lifetime 0->1, encoded in G channel

  void main() {
    vUv = uv;
    vOpacity = instanceColor.r;
    vT       = instanceColor.g;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ---- shared noise utility (used by both styles) -----------
// value noise -- cheap, no dependency on external includes
const noiseGlsl = /* glsl */ `
  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
`;

// ---- style 1: distorted ring with noise -------------------
// a ring that expands outward, edge perturbed by value noise
// gives an organic splatter / water-impact feel

const distortedFragmentShader = /* glsl */ `
  uniform vec3 uTint;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vT;

  ${noiseGlsl}

  void main() {
    // map uv to [-1, 1] centered
    vec2 p = vUv * 2.0 - 1.0;
    float dist = length(p);
    float angle = atan(p.y, p.x);

    // noise distortion -- varies around the ring circumference
    // two octaves for a bit of detail
    float n  = vnoise(vec2(angle * 2.0, vT * 3.0) * 3.0) * 0.5
             + vnoise(vec2(angle * 4.0, vT * 5.0) * 5.0) * 0.25;
    n = n * 0.5 + 0.5; // remap to 0->1 (was -ish 0->0.75)

    // ring expands from center outward over lifetime
    float ringRadius = 0.3 + vT * 0.55;  // 0.3 -> 0.85 of disc
    float ringWidth  = 0.18 - vT * 0.08; // narrows as it expands

    // perturb the ring radius by noise
    float perturbedRadius = ringRadius + (n - 0.5) * 0.18;

    // smooth ring -- distance from perturbed ring edge
    float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - perturbedRadius));

    // vignette -- fade toward outer edge so no hard clip
    float vignette = 1.0 - smoothstep(0.75, 1.0, dist);

    float alpha = ring * vignette * vOpacity;
    if (alpha < 0.01) discard;

    // slight brightness variation from noise -- more texture
    vec3 col = uTint * (0.8 + n * 0.4);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ---- style 2: concentric ripples --------------------------
// multiple expanding rings, fading with distance from center
// reads clearly as water drop even at small scale

const concentricFragmentShader = /* glsl */ `
  uniform vec3 uTint;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vT;

  ${noiseGlsl}

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float dist = length(p);

    // 3 concentric rings, each offset in time/radius
    // outermost ring leads, inner rings follow
    float rings = 0.0;
    float ringWidth = 0.10;

    for (int i = 0; i < 3; i++) {
      // each ring starts at a different phase so they're staggered
      float phase = float(i) * 0.28;
      float t = clamp(vT - phase, 0.0, 1.0);

      // ring expands from 0 to 0.9 over its phase-shifted lifetime
      float radius = t * 0.9;

      // ring fades out as it expands -- outermost is most faded
      float ringAlpha = (1.0 - t) * (1.0 - float(i) * 0.2);

      // slight noise on edge for a little organicness
      float angle = atan(p.y, p.x);
      float n = vnoise(vec2(angle * 3.0 + float(i), t * 4.0) * 2.5) * 0.5 + 0.5;
      float perturbedRadius = radius + (n - 0.5) * 0.05;

      float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - perturbedRadius));
      rings += ring * ringAlpha;
    }

    rings = clamp(rings, 0.0, 1.0);

    // fade hard clip at disc edge
    float vignette = 1.0 - smoothstep(0.8, 1.0, dist);

    float alpha = rings * vignette * vOpacity;
    if (alpha < 0.01) discard;

    vec3 col = uTint;// * (0.8 + 1.0 * 0.4);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ---- impact pool ------------------------------------------

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

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTint: { value: IMPACT_TINT },
        },
        vertexShader,
        fragmentShader:
          IMPACT_STYLE === "distorted"
            ? distortedFragmentShader
            : concentricFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useEffect(() => {
    const mesh = new THREE.InstancedMesh(geometry, material, IMPACT_POOL_SIZE);
    mesh.name = "RainImpacts";
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(IMPACT_POOL_SIZE * 3),
      3,
    );

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
    };
  }, [scene, geometry, material]);

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

    // ---- spawn --------------------------------------------
    if (intensity > 0) {
      spawnAccumulator.current += IMPACTS_PER_SECOND * intensity * safeDelta;

      while (spawnAccumulator.current >= 1) {
        spawnAccumulator.current -= 1;

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

    // ---- update instances ---------------------------------
    let matrixDirty = false;
    let colorDirty = false;

    for (let i = 0; i < IMPACT_POOL_SIZE; i++) {
      const impact = pool.current[i];
      if (!impact.active) continue;

      impact.age += safeDelta;

      if (impact.age >= IMPACT_LIFETIME) {
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

      // scale expands over lifetime
      const eased = 1 - Math.pow(1 - t, 3);
      const scale =
        IMPACT_START_SCALE + eased * (IMPACT_MAX_SCALE - IMPACT_START_SCALE);

      // opacity envelope
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

      // R = opacity, G = normalised lifetime t (used by shader for animation)
      colorScratch.current.setRGB(opacity, t, 0);
      mesh.setColorAt(i, colorScratch.current);

      matrixDirty = true;
      colorDirty = true;
    }

    if (matrixDirty) mesh.instanceMatrix.needsUpdate = true;
    if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return null;
}
