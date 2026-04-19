import { useRef, useMemo, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ChunkTreeData, TreeInstance } from "../../lib/placementUtils";

// placeholder colors -- swap when GLBs are ready
const VARIETY_COLORS = [
  new THREE.Color("#2d5a1b"), // A -- pine, dark green
  new THREE.Color("#4a7c3f"), // B -- oak, mid green
  new THREE.Color("#6a5a3a"), // C -- dead, brown
];

// placeholder geometry per variety
function createPinePlaceholder(): THREE.BufferGeometry {
  // tall narrow cone
  return new THREE.ConeGeometry(0.8, 6, 7);
}

function createOakPlaceholder(): THREE.BufferGeometry {
  // wider shorter cone
  return new THREE.ConeGeometry(1.4, 4, 8);
}

function createDeadPlaceholder(): THREE.BufferGeometry {
  // thin irregular cone -- fewer segments looks scraggly
  return new THREE.ConeGeometry(0.4, 5, 5);
}

const MAX_INSTANCES_PER_VARIETY = 500;

interface TreeManagerProps {
  chunksTreeRef: React.MutableRefObject<ChunkTreeData[]>;
}

export function TreeManager({ chunksTreeRef }: TreeManagerProps) {
  const { scene } = useThree();

  // one mesh ref per variety
  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null]);
  const lastDataRef = useRef<ChunkTreeData[]>([]);
  const activeCounts = useRef<[number, number, number]>([0, 0, 0]);
  const dummy = useRef(new THREE.Object3D());

  const geometries = useMemo(
    () => [
      createPinePlaceholder(),
      createOakPlaceholder(),
      createDeadPlaceholder(),
    ],
    [],
  );

  const materials = useMemo(
    () =>
      VARIETY_COLORS.map((color) => new THREE.MeshLambertMaterial({ color })),
    [],
  );

  // create all three instanced meshes imperatively
  useEffect(() => {
    const meshes = geometries.map((geo, i) => {
      const mesh = new THREE.InstancedMesh(
        geo,
        materials[i],
        MAX_INSTANCES_PER_VARIETY,
      );
      mesh.name = `TreeMesh_${i}`;
      mesh.frustumCulled = false;

      // hide all instances initially
      const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let j = 0; j < MAX_INSTANCES_PER_VARIETY; j++) {
        mesh.setMatrixAt(j, zeroMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      scene.add(mesh);
      meshRefs.current[i] = mesh;
      return mesh;
    });

    // reset last data to force rebuild on mount
    lastDataRef.current = [];

    return () => {
      meshes.forEach((mesh) => {
        scene.remove(mesh);
      });
    };
  }, [scene, geometries, materials]);

  const rebuildInstances = () => {
    const data = chunksTreeRef.current;

    // collect instances per variety
    const byVariety: TreeInstance[][] = [[], [], []];

    for (const chunk of data) {
      for (const inst of chunk.instances) {
        byVariety[inst.varietyIndex].push(inst);
      }
    }

    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    byVariety.forEach((instances, varietyIndex) => {
      const mesh = meshRefs.current[varietyIndex];
      if (!mesh) return;

      const count = Math.min(instances.length, MAX_INSTANCES_PER_VARIETY);

      for (let i = 0; i < count; i++) {
        const inst = instances[i];

        dummy.current.position.copy(inst.position);
        dummy.current.rotation.y = inst.rotation;
        dummy.current.scale.setScalar(inst.scale);
        dummy.current.updateMatrix();

        mesh.setMatrixAt(i, dummy.current.matrix);
      }

      // zero out unused instances
      for (let i = count; i < activeCounts.current[varietyIndex]; i++) {
        mesh.setMatrixAt(i, zeroMatrix);
      }

      activeCounts.current[varietyIndex] = count;
      mesh.instanceMatrix.needsUpdate = true;
    });
  };

  useFrame(() => {
    if (chunksTreeRef.current !== lastDataRef.current) {
      lastDataRef.current = chunksTreeRef.current;
      rebuildInstances();
    }
  });

  return null;
}
