import {
  useGLTF,
} from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";

export default function CharacterModel2(props: CharacterModelProps) {
  // Change the character src to yours
  const group = useRef<THREE.Group>();
  const { nodes, animations } = useGLTF("/Floating Character.glb") as GLTF & {
    nodes: any;
  };

  return (
    <Suspense fallback={<capsuleGeometry args={[0.3, 0.7]} />}>
      {/* Default capsule modle */}
       <mesh castShadow>
        <capsuleGeometry args={[0.3, 0.7]} />
        <meshStandardMaterial color="mediumpurple" />
      </mesh>
      <mesh castShadow position={[0, 0.2, 0.2]}>
        <boxGeometry args={[0.5, 0.2, 0.3]} />
        <meshStandardMaterial color="mediumpurple" />
      </mesh>
    </Suspense>
  );
}

export type CharacterModelProps = JSX.IntrinsicElements["group"];

// Change the character src to yours
useGLTF.preload("/Floating Character.glb");
