import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ChunkGrassData } from "../track/ChunkManager";

const MAX_GRASS_INSTANCES = 1000;
const GRASS_URL = "/models/bush.glb"; // update to match your filename

interface GrassManagerProps {
  chunksGrassRef: React.MutableRefObject<ChunkGrassData[]>;
}

export function GrassManager({ chunksGrassRef }: GrassManagerProps) {
  const { scene } = useThree();
  const { scene: grassScene } = useGLTF(GRASS_URL);

  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const lastDataRef = useRef<ChunkGrassData[]>([]);
  const dummy = useRef(new THREE.Object3D());
  const activeCount = useRef(0);

  useEffect(() => {
    // extract geometry and material from GLB
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.Material | null = null;

    grassScene.updateMatrixWorld(true);

    grassScene.traverse((obj) => {
      if (geometry) return; // take first mesh found
      if (!(obj instanceof THREE.Mesh)) return;

      // clone geometry and bake world transform
      const geo = obj.geometry.clone();
      geo.applyMatrix4(obj.matrixWorld);
      geometry = geo;

      material = Array.isArray(obj.material) ? obj.material[0] : obj.material;

      // disable fog if desired
      if (material) {
        (material as THREE.MeshStandardMaterial).fog = false;
      }
    });

    if (!geometry || !material) {
      console.warn("GrassManager: no mesh found in GLB");
      return;
    }

    console.log("GrassManager: GLB loaded successfully");

    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      MAX_GRASS_INSTANCES,
    );
    mesh.name = "GrassMesh";
    mesh.frustumCulled = false;

    // hide all instances initially
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_GRASS_INSTANCES; i++) {
      mesh.setMatrixAt(i, zeroMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    scene.add(mesh);
    meshRef.current = mesh;
    lastDataRef.current = [];

    return () => {
      scene.remove(mesh);
      geometry!.dispose();
    };
  }, [scene, grassScene]);

  const rebuildInstances = () => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const data = chunksGrassRef.current;
    let index = 0;

    for (const chunk of data) {
      for (const inst of chunk.instances) {
        if (index >= MAX_GRASS_INSTANCES) break;

        dummy.current.position.copy(inst.position);
        dummy.current.rotation.y = inst.rotation;
        dummy.current.scale.setScalar(inst.scale);
        dummy.current.updateMatrix();

        mesh.setMatrixAt(index, dummy.current.matrix);
        index++;
      }
      if (index >= MAX_GRASS_INSTANCES) break;
    }

    // zero out unused instances
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = index; i < activeCount.current; i++) {
      mesh.setMatrixAt(i, zeroMatrix);
    }

    activeCount.current = index;
    mesh.instanceMatrix.needsUpdate = true;
  };

  useFrame(() => {
    if (chunksGrassRef.current !== lastDataRef.current) {
      lastDataRef.current = chunksGrassRef.current;
      rebuildInstances();
    }
  });

  return null;
}

// preload
useGLTF.preload(GRASS_URL);
