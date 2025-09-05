"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense, useMemo, useRef,useLayoutEffect } from "react";
import * as THREE from "three";
import styles from "./components.module.css";

function BeadRing({
  count = 60,
  ringRadius = 10,
  beadRadius = 0.6,
  color = "#ff6699",
}: {
  count?: number;
  ringRadius?: number;
  beadRadius?: number;
  color?: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const geom = useMemo(
    () => new THREE.SphereGeometry(beadRadius, 32, 32),
    [beadRadius]
  );
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.2,
        transmission: 0.7,
        thickness: 0.5,
      }),
    [color]
  );
  const dummy = new THREE.Object3D();

  // 비즈 배치
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(t) * ringRadius, 0, Math.sin(t) * ringRadius);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, ringRadius]);

  return <instancedMesh ref={meshRef} args={[geom, mat, count]} />;
}

export default function BeadViewer({
  count,
  color,
}: {
  count: number;
  color: string;
}) {
  return (
    <div className={styles.componentsContainer}>
      <Canvas className={styles.canvas}
        camera={{ position: [0, 12, 28], fov: 50 }}
        dpr={[1, 1.5]} // 모바일 성능 보호
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <BeadRing count={count} color={color} />
          <Environment preset="city" />
          <OrbitControls enablePan={false} />
        </Suspense>
      </Canvas>
    </div>
  );
}
