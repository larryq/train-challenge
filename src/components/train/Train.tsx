/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sparkles, useGLTF } from "@react-three/drei";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useGameStore } from "../../stores/useGameStore";
import { getLevelConfig } from "../../lib/levelConfig";
import { useTrackStore } from "../../stores/useTrackStore";
// @ts-expect-error expect a complaint in shader include
import trainlightVert from "../../shaders/trainlight.vert.glsl";
// @ts-expect-error expect a complaint in shader include
import trainlightFrag from "../../shaders/trainlight.frag.glsl";

// function createSparkMaterial(side: number): THREE.ShaderMaterial {
//   return new THREE.ShaderMaterial({
//     uniforms: {
//       uTime: { value: 0 },
//       uCurvature: { value: 0 },
//       uSide: { value: side }, // -1 left, 1 right
//     },
//     vertexShader: sparkVert,
//     fragmentShader: sparkFrag,
//     transparent: true,
//     depthWrite: false,
//     side: THREE.DoubleSide,
//     blending: THREE.AdditiveBlending, // sparks add light, looks hot
//   });
// }

interface TrainProps {
  masterCurveRef: React.MutableRefObject<THREE.CatmullRomCurve3 | null>;
  trainPositionRef: React.MutableRefObject<THREE.Vector3>;
  trainTRef: React.MutableRefObject<number>;
  cycleValue: number;
}

function createTrainLightMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCycleValue: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: trainlightVert,
    fragmentShader: trainlightFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export function Train({
  masterCurveRef,
  trainPositionRef,
  trainTRef,
  cycleValue,
}: TrainProps) {
  const trainRef = useRef<THREE.Group>(null);
  const targetRef = useRef<THREE.Mesh>(null);

  const trainLightMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const curvatureRef = useRef(0);

  const currentPitch = useRef(0);

  const addDistance = usePlayerStore((s) => s.addDistance);
  const setSpeed = usePlayerStore((s) => s.setSpeed);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const isReady = useTrackStore((s) => s.isReady);
  const phase = useGameStore((s) => s.phase);

  const { scene: trainScene } = useGLTF("/models/train1.glb");

  const wheelRefs = useRef<THREE.Object3D[]>([]);
  const [curvature, setCurvature] = useState(0);
  const leftWheelPos = useRef(new THREE.Vector3());
  const rightWheelPos = new THREE.Vector3();

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

  useEffect(() => {
    const mesh = trainScene.getObjectByName("trainlight") as THREE.Mesh;
    if (!mesh) {
      console.warn("trainlight mesh not found");
      return;
    }

    const mat = createTrainLightMaterial();
    mesh.material = mat;
    mesh.frustumCulled = false;
    mesh.renderOrder = 999;

    trainLightMatRef.current = mat;
    console.log("Train light material applied");
  }, [trainScene]);

  const leftMesh = trainScene.getObjectByName("wheel009") as THREE.Mesh;
  const rightMesh = trainScene.getObjectByName("wheel011") as THREE.Mesh;

  useFrame(({ clock }, delta) => {
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

    // compute curvature for spark effect
    const tan1 = curve.getTangentAt(newT);
    const tan2 = curve.getTangentAt(Math.min(newT + 0.02, 0.9999));
    const rawCurvature = 1.0 - tan1.dot(tan2);

    // amplify and smooth -- small curves barely register, sharp ones are obvious
    const targetCurvature = THREE.MathUtils.clamp(rawCurvature * 25, 0, 1);
    curvatureRef.current = THREE.MathUtils.lerp(
      curvatureRef.current,
      targetCurvature,
      safeDelta * 4,
    );
    // update React state every ~100ms to drive Sparkles props
    // don't update every frame -- Sparkles re-renders on prop change
    if (Math.random() < 0.06) {
      setCurvature(curvatureRef.current);
      //console.log("curvature value: " + curvatureRef.current);
    }

    if (leftMesh && rightMesh) {
      leftMesh.getWorldPosition(leftWheelPos.current);
      rightMesh.getWorldPosition(rightWheelPos);
      // console.log(JSON.stringify(leftWheelPos, null, 2));
    }
    if (trainLightMatRef.current) {
      trainLightMatRef.current.uniforms.uCycleValue.value = cycleValue;
      trainLightMatRef.current.uniforms.uTime.value =
        clock.getElapsedTime() % 10.0;
    }
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
          {/* spark effects at rear wheels */}
          {curvature > 0.99 && (
            <>
              <Sparkles
                position={[-0.47, -0.19, -0.6]} // left wheel local pos
                count={30}
                //scale={1.5}
                scale={[0.15, 0.15, 0.15]}
                size={curvature * 2}
                speed={curvature * 0.005}
                color="#ececdc"
                noise={0.25}
                opacity={curvature}
              />
              {/* <Sparkles
                position={rightWheelPos}
                count={Math.floor(curvature * 80)}
                scale={1.5}
                size={curvature * 8}
                speed={curvature * 6}
                color="#ff6600"
                noise={0.5}
              />*/}
              {/* <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshBasicMaterial color="red" />
              </mesh> */}
            </>
          )}
        </group>
        <spotLight
          position={[0, 1.5, 2]}
          angle={Math.PI / 7}
          penumbra={0.4}
          intensity={cycleValue * 20} // fades in as dusk arrives
          distance={80}
          color="#fff5e0"
          castShadow={false}
        />
      </group>
    </>
  );
}
