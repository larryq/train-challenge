import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useGameStore } from "../../stores/useGameStore";
import { getLevelConfig } from "../../lib/levelConfig";
import { useTrackStore } from "../../stores/useTrackStore";

interface TrainProps {
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  trainTRef: React.MutableRefObject<number>;
}

export function Train({
  masterCurveRef,
  trainPositionRef,
  trainTRef,
}: TrainProps) {
  const trainRef = useRef<THREE.Group>(null);
  const targetRef = useRef<THREE.Mesh>(null);
  const currentPitch = useRef(0);

  const addDistance = usePlayerStore((s) => s.addDistance);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const isReady = useTrackStore((s) => s.isReady);
  const phase = useGameStore((s) => s.phase);

  useFrame((_, delta) => {
    if (!isReady) return; // don't move train until track is ready
    const curve = masterCurveRef.current;
    if (!curve || !trainRef.current || !targetRef.current) return;
    if (phase !== "playing") return;

    // clamp delta -- prevents huge jumps after tab switch or lag spike
    const safeDelta = Math.min(delta, 0.05); // max 50ms = 20fps minimum

    const config = getLevelConfig(currentLevel);
    //const speed = config.trainSpeed;

    // fixed world-space speed in units per second
    // this stays constant regardless of curve length
    const worldSpeed = config.trainSpeed; // tune the multiplier

    // convert world speed to t increment for this curve length
    const tIncrement = (worldSpeed * safeDelta) / curve.getLength();

    // advance t along the curve
    // clamp to just under 1.0 -- ChunkManager keeps adding points
    // so we never actually reach the end
    const newT = Math.min(trainTRef.current + tIncrement, 0.9999);
    trainTRef.current = newT;

    // log speed every ~second
    // if (Math.random() < 0.016) {
    //   const actualSpeed = tIncrement;
    //   console.log(
    //     `trainT=${trainTRef.current.toFixed(4)}`,
    //     `speed=${actualSpeed.toFixed(3)}`,
    //     `curveLen=${curve.getLength().toFixed(1)}`,
    //   );
    // }

    // position
    const pos = curve.getPointAt(newT);
    trainRef.current.position.copy(pos);
    trainRef.current.position.y += 0.5; // sit above rail height

    // lookahead target for yaw
    const lookAheadT = Math.min(newT + 0.005, 0.9999);
    const targetPos = curve.getPointAt(lookAheadT);
    targetRef.current.position.copy(targetPos);
    targetRef.current.position.y += 0.5;

    // yaw -- look at the target
    trainRef.current.lookAt(targetRef.current.position);

    // pitch -- derived from tangent Y component
    const tangent = curve.getTangentAt(newT);
    const targetPitch = Math.asin(THREE.MathUtils.clamp(tangent.y, -1, 1));

    // smooth pitch transition
    currentPitch.current = THREE.MathUtils.lerp(
      currentPitch.current,
      targetPitch,
      safeDelta * 2.0,
    );

    // apply pitch on top of yaw -- must come AFTER lookAt
    trainRef.current.rotateX(-currentPitch.current);

    // update shared refs so ChunkManager and CameraRig can read them
    trainPositionRef.current.copy(trainRef.current.position);

    // update distance traveled in world units
    const distanceDelta = worldSpeed * safeDelta;
    addDistance(distanceDelta);
    setSpeed(worldSpeed);
  });

  return (
    <>
      {/* invisible lookahead target */}
      <mesh ref={targetRef} visible={true}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial />
      </mesh>

      {/* train placeholder -- replace with GLB later */}
      <group ref={trainRef} scale={[0.5, 0.5, 0.5]}>
        {/* body */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.5, 1, 3]} />
          <meshStandardMaterial color="#cc4400" />
        </mesh>

        {/* cab */}
        <mesh position={[0, 1.2, -0.8]}>
          <boxGeometry args={[1.3, 0.6, 1]} />
          <meshStandardMaterial color="#cc4400" />
        </mesh>

        {/* chimney */}
        <mesh position={[0, 1.6, 0.8]}>
          <cylinderGeometry args={[0.15, 0.2, 0.5, 8]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* front wheels left */}
        <mesh position={[-0.8, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.15, 16]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* front wheels right */}
        <mesh position={[0.8, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.15, 16]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* rear wheels left */}
        <mesh position={[-0.8, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.15, 16]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* rear wheels right */}
        <mesh position={[0.8, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.15, 16]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
    </>
  );
}
