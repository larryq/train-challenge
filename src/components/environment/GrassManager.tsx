import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ChunkGrassData } from "../track/ChunkManager";

// color palette -- three shades of green
const GRASS_COLORS = [
  new THREE.Color("#2d5a1b"), // dark
  new THREE.Color("#4a7c3f"), // mid
  new THREE.Color("#6a9a4f"), // light
];

const MAX_GRASS_INSTANCES = 5000;

// procedural crossed-plane grass geometry
function createGrassGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();

  const w = 0.5; // half width
  const h = 0.7; // height

  // two crossed planes -- 4 vertices each, 8 total
  const vertices = new Float32Array([
    // plane 1 -- along X axis
    -w,
    0,
    0,
    w,
    0,
    0,
    w,
    h,
    0,
    -w,
    h,
    0,

    // plane 2 -- along Z axis
    0,
    0,
    -w,
    0,
    0,
    w,
    0,
    h,
    w,
    0,
    h,
    -w,
  ]);

  // two quads = 4 triangles = 12 indices
  const indices = new Uint16Array([
    // plane 1
    0, 1, 2, 0, 2, 3,
    // plane 2
    4, 5, 6, 4, 6, 7,
  ]);

  // UVs -- simple 0-1 mapping per plane
  const uvs = new Float32Array([
    0,
    0,
    1,
    0,
    1,
    1,
    0,
    1, // plane 1
    0,
    0,
    1,
    0,
    1,
    1,
    0,
    1, // plane 2
  ]);

  // normals -- both planes face up for simple lighting
  const normals = new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]);

  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  return geo;
}

interface GrassManagerProps {
  chunksGrassRef: React.MutableRefObject<ChunkGrassData[]>;
}

export function GrassManager({ chunksGrassRef }: GrassManagerProps) {
  const { scene } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lastDataRef = useRef<ChunkGrassData[]>([]);
  const dummy = useRef(new THREE.Object3D());
  const activeCount = useRef(0);

  const geometry = useMemo(() => createGrassGeometry(), []);

  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        // when GLB is ready with texture:
        // map: grassTexture,
      }),
    [],
  );

  // create mesh imperatively and add to scene
  useEffect(() => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      MAX_GRASS_INSTANCES,
    );
    mesh.name = "GrassMesh";
    mesh.frustumCulled = false; // add this line
    // hide all instances initially
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_GRASS_INSTANCES; i++) {
      mesh.setMatrixAt(i, zeroMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    meshRef.current = mesh;
    lastDataRef.current = [];
    scene.add(mesh);

    console.log("GrassManager: mesh added to scene");

    return () => {
      scene.remove(mesh);
      //mesh.geometry.dispose();
      console.log("GrassManager: mesh removed from scene");
    };
  }, [scene, geometry, material]);

  // rebuild all instance matrices when chunk data changes
  const rebuildInstances = () => {
    const mesh = meshRef.current;
    if (!mesh) return;

    console.log(
      "rebuildInstances called, data length:",
      chunksGrassRef.current.length,
    );

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
        mesh.setColorAt(index, GRASS_COLORS[inst.colorIndex]);

        index++;
      }

      if (index >= MAX_GRASS_INSTANCES) break;
    }

    console.log(
      "final index:",
      index,
      "previous activeCount:",
      activeCount.current,
    );

    // hide unused instances by scaling to zero
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = index; i < activeCount.current; i++) {
      mesh.setMatrixAt(i, zeroMatrix);
    }

    activeCount.current = index;

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    //mesh.count = MAX_GRASS_INSTANCES;
  };

  // check for chunk data changes each frame
  useFrame(() => {
    if (chunksGrassRef.current !== lastDataRef.current) {
      lastDataRef.current = chunksGrassRef.current;
      rebuildInstances();
    }
  });

  return null;
  //   return (
  //     <instancedMesh
  //       ref={meshRef}
  //       args={[geometry, material, MAX_GRASS_INSTANCES]}
  //       castShadow={false}
  //       receiveShadow={false}
  //     ></instancedMesh>
  //   );
}
