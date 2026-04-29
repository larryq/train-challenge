import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ChunkTreeData, TreeInstance } from "../../lib/placementUtils";

const MAX_INSTANCES_PER_VARIETY = 500;

const TREE_URLS = [
  "/models/tree2.glb",
  "/models/tree4.glb",
  "/models/tree3.glb",
  "/models/tree4.glb",
  "/models/tree5.glb",
];

// ---- fallbacks --------------------------------------------

function createFallbackGeometry(i: number): THREE.BufferGeometry {
  switch (i) {
    case 0:
      return new THREE.ConeGeometry(0.8, 6, 7);
    case 1:
      return new THREE.ConeGeometry(1.4, 4, 8);
    default:
      return new THREE.ConeGeometry(0.4, 5, 5);
  }
}

function createFallbackMaterial(i: number): THREE.Material {
  const colors = ["#2d5a1b", "#4a7c3f", "#6a5a3a"];
  return new THREE.MeshLambertMaterial({ color: colors[i], fog: false });
}

// ---- GLB extraction ---------------------------------------

interface MeshData {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

function extractAllFromGLB(gltfScene: THREE.Group): MeshData[] {
  const results: MeshData[] = [];

  gltfScene.updateMatrixWorld(true);

  gltfScene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    // clone geometry and bake world transform into it
    // so all sub-meshes share the same coordinate space
    const geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);

    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;

    results.push({ geometry: geo, material: mat });
  });

  return results;
}

// ---- helpers ----------------------------------------------

function initInstancedMesh(mesh: THREE.InstancedMesh) {
  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let j = 0; j < MAX_INSTANCES_PER_VARIETY; j++) {
    mesh.setMatrixAt(j, zeroMatrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// ---- component --------------------------------------------

interface TreeManagerProps {
  chunksTreeRef: React.MutableRefObject<ChunkTreeData[]>;
}

export function TreeManager({ chunksTreeRef }: TreeManagerProps) {
  const { scene } = useThree();

  const glb0 = useGLTF(TREE_URLS[0]);
  const glb1 = useGLTF(TREE_URLS[1]);
  const glb2 = useGLTF(TREE_URLS[2]);
  const glb3 = useGLTF(TREE_URLS[3]);
  const glb4 = useGLTF(TREE_URLS[4]);

  // 2D array -- meshRefs[varietyIndex][subMeshIndex]
  const meshRefs = useRef<THREE.InstancedMesh[][]>([[], [], []]);
  const lastDataRef = useRef<ChunkTreeData[]>([]);
  const activeCounts = useRef<[number, number, number]>([0, 0, 0]);
  const dummy = useRef(new THREE.Object3D());

  useEffect(() => {
    const glbScenes = [
      glb0.scene as THREE.Group,
      glb1.scene as THREE.Group,
      glb2.scene as THREE.Group,
      glb3.scene as THREE.Group,
      glb4.scene as THREE.Group,
    ];

    const allMeshGroups: THREE.InstancedMesh[][] = [];

    glbScenes.forEach((gltfScene, varietyIndex) => {
      const meshDatas = extractAllFromGLB(gltfScene);
      const meshGroup: THREE.InstancedMesh[] = [];

      gltfScene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((mat) => {
          mat.fog = false;
          mat.needsUpdate = true;
        });
      });
      if (meshDatas.length === 0) {
        // fallback -- no meshes found in GLB
        console.warn(
          `TreeManager: no meshes found in GLB variety ${varietyIndex}, using placeholder`,
        );
        const mesh = new THREE.InstancedMesh(
          createFallbackGeometry(varietyIndex),
          createFallbackMaterial(varietyIndex),
          MAX_INSTANCES_PER_VARIETY,
        );
        mesh.name = `TreeMesh_${varietyIndex}_0`;
        mesh.frustumCulled = false;
        initInstancedMesh(mesh);
        scene.add(mesh);
        meshGroup.push(mesh);
      } else {
        console.log(
          `TreeManager: variety ${varietyIndex} -- ${meshDatas.length} sub-meshes`,
        );

        meshDatas.forEach((data, meshIndex) => {
          const mesh = new THREE.InstancedMesh(
            data.geometry,
            data.material,
            MAX_INSTANCES_PER_VARIETY,
          );
          mesh.name = `TreeMesh_${varietyIndex}_${meshIndex}`;
          mesh.frustumCulled = false;
          initInstancedMesh(mesh);
          scene.add(mesh);
          meshGroup.push(mesh);
        });
      }

      allMeshGroups.push(meshGroup);
    });

    meshRefs.current = allMeshGroups;
    lastDataRef.current = [];

    return () => {
      allMeshGroups.forEach((group) => {
        group.forEach((mesh) => {
          mesh.geometry.dispose();
          scene.remove(mesh);
        });
      });
    };
  }, [scene, glb0.scene, glb1.scene, glb2.scene, glb3.scene, glb4.scene]);

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
      const meshGroup = meshRefs.current[varietyIndex];
      if (!meshGroup || meshGroup.length === 0) return;

      const count = Math.min(instances.length, MAX_INSTANCES_PER_VARIETY);

      // set matrices for active instances
      for (let i = 0; i < count; i++) {
        const inst = instances[i];
        dummy.current.position.copy(inst.position);
        dummy.current.rotation.y = inst.rotation;
        dummy.current.scale.setScalar(inst.scale);
        dummy.current.updateMatrix();

        // same matrix applied to ALL sub-meshes for this instance
        // trunk and canopy always move together
        meshGroup.forEach((mesh) => {
          mesh.setMatrixAt(i, dummy.current.matrix);
        });
      }

      // zero out unused slots
      for (let i = count; i < activeCounts.current[varietyIndex]; i++) {
        meshGroup.forEach((mesh) => {
          mesh.setMatrixAt(i, zeroMatrix);
        });
      }

      activeCounts.current[varietyIndex] = count;

      // mark all sub-meshes as needing GPU update
      meshGroup.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
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

// preload GLBs
TREE_URLS.forEach((url) => useGLTF.preload(url));
