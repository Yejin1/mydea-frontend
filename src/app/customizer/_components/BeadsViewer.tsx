"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useLayoutEffect } from "react";

function BeadRingTorus({
  count = 50,          // 비즈 개수 = 길이감
  ringRadius = 10,     // 반지 반경
  outer = 0.9,         // 토러스 바깥쪽 반경(대반경) = 비즈 길이의 절반 느낌
  tube = 0.28,         // 토러스 두께(벽 두께 느낌)
  color = "#ff8aa8",
}: {
  count?: number;
  ringRadius?: number;
  outer?: number;
  tube?: number;
  color?: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.TorusGeometry(outer, tube, 24, 48), [outer, tube]);
  const mat  = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.15,
        metalness: 0.0,
        transmission: 0.9, 
        thickness: 0.8,
        ior: 1.25,
      }),
    [color]
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const upY   = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const colors = ["#f09999", "#9dc99f", "#b0bcfc"];
  const colorArr = colors.map(c => new THREE.Color(c));

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
      const tangent = new THREE.Vector3(-Math.sin(t), 0, Math.cos(t)).normalize();

      // 위치/회전 적용
      dummy.position.set(x, y, z);
      // 토러스의 Y축(구멍 축)을 접선 방향으로 정렬
      dummy.quaternion.setFromUnitVectors(upY, tangent);

      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, colorArr[i % colorArr.length]);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count, ringRadius, upY]);

  return <instancedMesh ref={meshRef} args={[geom, mat, count]} />;
}

export default function BeadsViewer() {
  return (
    <Canvas camera={{ position: [0, 10, 22], fov: 35 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} />
      <BeadRingTorus
        count={27}
        ringRadius={7}
        outer={0.15}  
        tube={0.63}
        color="#ffffff"
      />
    </Canvas>
  );
}
