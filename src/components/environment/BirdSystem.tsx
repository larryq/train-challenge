import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ---- constants --------------------------------------------

const BIRDS_PER_FLOCK = 3;

const BIRD_WING_SPAN = 1.8; // total width tip to tip
const BIRD_WING_DEPTH = 0.45; // front to back
const BIRD_WING_TIP_RISE = 0.15; // how much wingtips angle upward
const BIRD_COLOR = "#222233";

const BIRD_MIN_ALTITUDE = 4; // world units above ground
const BIRD_MAX_ALTITUDE = 7;
const BIRD_MIN_SPEED = 10; // units per second across scene
const BIRD_MAX_SPEED = 16;
const BIRD_SPAWN_LATERAL = 10; // units to the side of train at spawn
const BIRD_EXIT_DISTANCE = 70; // true world distance from train before despawn

const BIRD_VERTICAL_FREQ = 0.9; // Hz of vertical sine drift
const BIRD_VERTICAL_AMP = 2.2; // units of vertical drift
const BIRD_LATERAL_FREQ = 0.5; // Hz of lateral weave
const BIRD_LATERAL_AMP = 1.2; // units of lateral weave

const BIRD_SPAWN_STAGGER = 0.5; // seconds between birds in same flock
const BIRD_FORWARD_OFFSET = 15; // units ahead of train when spawned

const FLOCK_MIN_INTERVAL = 5; // seconds between flocks minimum
const FLOCK_MAX_INTERVAL = 15; // seconds between flocks maximum

// ---- bird geometry ----------------------------------------

function makeBirdGeometry(): THREE.BufferGeometry {
  const hw = BIRD_WING_SPAN / 2;
  const d = BIRD_WING_DEPTH;
  const r = BIRD_WING_TIP_RISE;

  const verts = new Float32Array([
    // left wing -- triangle: body, L_back, L_tip
    0,
    0,
    0,
    -hw * 0.4,
    0,
    d,
    -hw,
    r,
    d * 0.3,

    // right wing -- triangle: body, R_tip, R_back
    0,
    0,
    0,
    hw,
    r,
    d * 0.3,
    hw * 0.4,
    0,
    d,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---- bird state -------------------------------------------

interface Bird {
  active: boolean;
  spawnDelay: number;
  elapsed: number;
  startLateralOffset: number;
  altitude: number;
  speed: number;
  direction: number; // +1 or -1
  vertPhase: number;
  latPhase: number;
  yawAngle: number; // world-space yaw derived from lateral dir at spawn
  forwardOffset: number;
  worldX: number; // fixed world position at spawn
  worldZ: number;
  travelDirX: number; // world-space lateral travel direction
  travelDirZ: number;
}

function makeBird(): Bird {
  return {
    active: false,
    spawnDelay: 0,
    elapsed: -999,
    startLateralOffset: 0,
    altitude: 0,
    speed: 0,
    direction: 1,
    vertPhase: Math.random() * Math.PI * 2,
    latPhase: Math.random() * Math.PI * 2,
    yawAngle: 0,
    forwardOffset: 0,
    worldX: 0,
    worldZ: 0,
    travelDirX: 0,
    travelDirZ: 0,
  };
}

// ---- component --------------------------------------------

interface BirdSystemProps {
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  trainDirectionRef: React.MutableRefObject<THREE.Vector3>;
}

export function BirdSystem({
  trainPositionRef,
  trainDirectionRef,
}: BirdSystemProps) {
  const { scene } = useThree();

  const geometry = useMemo(() => makeBirdGeometry(), []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BIRD_COLOR,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [],
  );

  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  useEffect(() => {
    const mesh = new THREE.InstancedMesh(geometry, material, BIRDS_PER_FLOCK);
    mesh.name = "BirdSystem";
    mesh.frustumCulled = false;

    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < BIRDS_PER_FLOCK; i++) {
      mesh.setMatrixAt(i, zeroMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    scene.add(mesh);
    meshRef.current = mesh;

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    };
  }, [scene, geometry, material]);

  const birds = useRef<Bird[]>(
    Array.from({ length: BIRDS_PER_FLOCK }, () => makeBird()),
  );

  const flockActive = useRef(false);
  const nextFlockIn = useRef(
    randomBetween(FLOCK_MIN_INTERVAL, FLOCK_MAX_INTERVAL),
  );
  const idleTimer = useRef(0);
  const dummy = useRef(new THREE.Object3D());
  const zeroMatrix = useRef(new THREE.Matrix4().makeScale(0, 0, 0));

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const safeDelta = Math.min(delta, 0.05);
    const trainPos = trainPositionRef.current;

    // ---- flock trigger ------------------------------------
    if (!flockActive.current) {
      idleTimer.current += safeDelta;
      if (idleTimer.current >= nextFlockIn.current) {
        // eslint-disable-next-line react-hooks/immutability
        triggerFlock(trainPos);
      }
    }

    // ---- update birds ------------------------------------
    let anyActive = false;
    let dirty = false;

    for (let i = 0; i < BIRDS_PER_FLOCK; i++) {
      const bird = birds.current[i];

      bird.elapsed += safeDelta;

      // waiting for stagger delay
      if (bird.elapsed < bird.spawnDelay) {
        mesh.setMatrixAt(i, zeroMatrix.current);
        dirty = true;
        continue;
      }

      if (!bird.active) bird.active = true;

      const t = bird.elapsed - bird.spawnDelay;

      // lateral travel in world space along travelDir
      const lateralTravel = t * bird.speed;

      // weave -- perpendicular to travel direction
      const weave =
        Math.sin(t * Math.PI * 2 * BIRD_LATERAL_FREQ + bird.latPhase) *
        BIRD_LATERAL_AMP;
      const weaveX = bird.travelDirZ * weave;
      const weaveZ = -bird.travelDirX * weave;

      // vertical drift
      const vertDrift =
        Math.sin(t * Math.PI * 2 * BIRD_VERTICAL_FREQ + bird.vertPhase) *
        BIRD_VERTICAL_AMP;

      // world position -- fixed spawn point + travel + weave
      const x = bird.worldX + bird.travelDirX * lateralTravel + weaveX;
      const y = bird.altitude + vertDrift;
      const z = bird.worldZ + bird.travelDirZ * lateralTravel + weaveZ;

      // true distance from train -- despawn when far enough away
      const dx = x - trainPos.x;
      const dz = z - trainPos.z;
      const distFromTrain = Math.sqrt(dx * dx + dz * dz);
      //console.log(`birds flying ${distFromTrain.toFixed(1)} away!`);
      const birdDespawnFudgeFactor = 10;
      const maxLifetime =
        (BIRD_SPAWN_LATERAL * 2 + birdDespawnFudgeFactor) / bird.speed;
      if (t > maxLifetime) {
        mesh.setMatrixAt(i, zeroMatrix.current);
        dirty = true;
        continue;
      }

      anyActive = true;

      // slight bank from weave rate
      const weaveRate =
        Math.cos(t * Math.PI * 2 * BIRD_LATERAL_FREQ + bird.latPhase) *
        BIRD_LATERAL_AMP *
        BIRD_LATERAL_FREQ *
        Math.PI *
        2;
      const bankAngle = weaveRate * 0.08 * bird.direction;

      dummy.current.position.set(x, y, z);
      dummy.current.rotation.set(0, bird.yawAngle, bankAngle);
      dummy.current.scale.setScalar(1);
      dummy.current.updateMatrix();

      mesh.setMatrixAt(i, dummy.current.matrix);
      dirty = true;
    }

    if (dirty) mesh.instanceMatrix.needsUpdate = true;

    // flock complete when all birds have exited
    if (flockActive.current && !anyActive) {
      flockActive.current = false;
      idleTimer.current = 0;
      nextFlockIn.current = randomBetween(
        FLOCK_MIN_INTERVAL,
        FLOCK_MAX_INTERVAL,
      );
    }
  });

  function triggerFlock(trainPos: THREE.Vector3) {
    flockActive.current = true;
    idleTimer.current = 0;

    const lateralDirection = Math.random() < 0.5 ? 1 : -1;
    const baseAltitude = randomBetween(BIRD_MIN_ALTITUDE, BIRD_MAX_ALTITUDE);
    const baseSpeed = randomBetween(BIRD_MIN_SPEED, BIRD_MAX_SPEED);

    // flatten train direction to XZ plane
    const forward = trainDirectionRef.current.clone();
    forward.y = 0;
    forward.normalize();

    // perpendicular lateral axis
    const lateral = new THREE.Vector3(-forward.z, 0, forward.x).normalize();

    // yaw derived from actual lateral travel direction so birds face correctly
    const travelDirX = lateral.x * lateralDirection;
    const travelDirZ = lateral.z * lateralDirection;
    const yawAngle = Math.atan2(travelDirX, travelDirZ);

    for (let i = 0; i < BIRDS_PER_FLOCK; i++) {
      const bird = birds.current[i];

      bird.active = false;
      bird.elapsed = 0;
      bird.spawnDelay = i * BIRD_SPAWN_STAGGER;
      bird.direction = lateralDirection;
      bird.yawAngle = yawAngle;
      bird.forwardOffset = BIRD_FORWARD_OFFSET + randomBetween(-3, 3);
      bird.startLateralOffset = -lateralDirection * BIRD_SPAWN_LATERAL;
      bird.altitude = baseAltitude + randomBetween(-2, 2);
      bird.speed = baseSpeed + randomBetween(-2, 2);
      bird.vertPhase = Math.random() * Math.PI * 2;
      bird.latPhase = Math.random() * Math.PI * 2;

      // fixed world spawn position
      bird.worldX =
        trainPos.x +
        forward.x * bird.forwardOffset +
        lateral.x * bird.startLateralOffset;
      bird.worldZ =
        trainPos.z +
        forward.z * bird.forwardOffset +
        lateral.z * bird.startLateralOffset;

      bird.travelDirX = travelDirX;
      bird.travelDirZ = travelDirZ;
    }
  }

  return null;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
