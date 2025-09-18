"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useLayoutEffect } from "react";

function BeadRingTorus({
  count = 21, // 비즈 개수 = 길이감
  ringRadius = 11, // 반지 반경
  outer = 0.9, // 토러스 바깥쪽 반경(대반경) = 비즈 길이의 절반 느낌
  tube = 0.28, // 토러스 두께(벽 두께 느낌)
  colors = ["#f09999", "#9dc99f", "#e5e8fa"],
}: {
  count?: number;
  ringRadius?: number;
  outer?: number;
  tube?: number;
  color?: string;
  colors?: string[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(
    () => new THREE.TorusGeometry(outer, tube, 24, 48),
    [outer, tube]
  );
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "rgba(255, 255, 255, 1)",
        roughness: 0.15,
        transmission: 0.7,
        thickness: 0.6,
        ior: 1.45,
      }),
    []
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const upY = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const colorArr = useMemo(
    () => colors.map((c) => new THREE.Color(c)),
    [colors]
  );

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;

    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;

      // 원 위의 위치
      const x = Math.cos(t) * ringRadius;
      const z = Math.sin(t) * ringRadius;
      const y = 1;

      // 접선 벡터(실이 지나가는 방향)
      const tangent = new THREE.Vector3(
        -Math.sin(t),
        0,
        Math.cos(t)
      ).normalize();

      // 위치/회전 적용
      dummy.position.set(x, y, z);
      // 토러스의 Y축(구멍 축)을 접선 방향으로 정렬
      dummy.quaternion.setFromUnitVectors(upY, tangent);

      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, colorArr[i % colorArr.length]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) {
      m.instanceColor.needsUpdate = true;
    }
  }, [count, ringRadius, upY, colorArr, dummy]);

  return <instancedMesh ref={meshRef} args={[geom, mat, count]} />;
}

export default function BeadsViewer({
  colors,
  count,
  ringRadius,
  cameraDistance = 25,
}: {
  colors?: string[];
  count?: number;
  ringRadius?: number;
  cameraDistance?: number;
}) {
  return (
    <Canvas
      camera={{ position: [0, 10, cameraDistance], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} />
      <BeadRingTorus
        count={count}
        ringRadius={ringRadius}
        outer={0.12} //0.13
        tube={0.615} //0.63
        colors={colors}
      />
    </Canvas>
  );
}
