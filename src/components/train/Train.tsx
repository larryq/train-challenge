import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
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

  const { scene: trainScene } = useGLTF("/models/train1.glb");

  const wheelRefs = useRef<THREE.Object3D[]>([]);

  // find wheels after GLB loads
  useEffect(() => {
    wheelRefs.current = [];
    trainScene.traverse((obj) => {
      if (obj.name.startsWith("wheel") && !obj.name.startsWith("wheels")) {
        wheelRefs.current.push(obj);
      }
    });
    console.log(
      "Found wheels:",
      wheelRefs.current.map((w) => w.name),
    );
  }, [trainScene]);

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

    // // position
    // const pos = curve.getPointAt(newT);
    // trainRef.current.position.copy(pos);
    // trainRef.current.position.y += 0.5; // sit above rail height

    // // lookahead target for yaw
    // const lookAheadT = Math.min(newT + 0.005, 0.9999);
    // const targetPos = curve.getPointAt(lookAheadT);
    // targetRef.current.position.copy(targetPos);
    // targetRef.current.position.y += 0.5;

    // // yaw -- look at the target
    // trainRef.current.lookAt(targetRef.current.position);

    const axleSpacing = 2.8; // world units between front and rear axle.  Hand-tuned value.
    const curveLength = curve.getLength();

    const frontT = Math.min(newT + (axleSpacing * 0.5) / curveLength, 0.9999);
    const rearT = Math.max(newT - (axleSpacing * 0.5) / curveLength, 0);

    const frontPos = curve.getPointAt(frontT);
    const rearPos = curve.getPointAt(rearT);

    // train center is midpoint between axles
    const centerPos = frontPos.clone().add(rearPos).multiplyScalar(0.5);
    trainRef.current.position.copy(centerPos);
    trainRef.current.position.y += 0.5;

    // train faces from rear to front axle
    trainRef.current.lookAt(frontPos.clone().setY(centerPos.y + 0.5));

    // rotate wheels -- constant rate regardless of train speed
    const WHEEL_ROTATION_SPEED = 2.0; // radians per second -- tune to taste
    wheelRefs.current.forEach((wheel) => {
      wheel.rotation.x += WHEEL_ROTATION_SPEED * safeDelta;
    });

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
    trainRef.current.rotateX(-currentPitch.current * 1.3);

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

      <group ref={trainRef}>
        <group
          position={[0, 0, 0]}
          scale={[0.65, 0.65, 0.65]} // tune this
        >
          <primitive object={trainScene} />
        </group>
      </group>
    </>
  );
}
