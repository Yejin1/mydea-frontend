"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useLayoutEffect } from "react";

function BeadRingTorus({
  // count: 원을 따라 배치할 비즈(토러스) 개수
  count = 21,
  // ringRadius: 비즈들이 놓이는 원의 반지름(반지/팔찌/목걸이 크기)
  ringRadius = 11,
  // outer: 토러스의 대반경(중심에서 도넛 중심까지) → 비즈 길이감에 해당
  outer = 0.9,
  // tube: 토러스의 소반경(도넛의 두께)
  tube = 0.28,
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
  // 단일 토러스 지오메트리/머티리얼을 복수 인스턴스로 재사용(메모리 효율, 성능 향상)
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

  // 인스턴스 변환(행렬) 계산에 사용하는 더미 오브젝트
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // 토러스의 기본 축으로 사용할 단위 벡터(Z축 사용)
  const upY = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  // 색상 팔레트를 THREE.Color로 변환해 반복 적용
  const colorArr = useMemo(
    () => colors.map((c) => new THREE.Color(c)),
    [colors]
  );

  useLayoutEffect(() => {
    const m = meshRef.current;
    if (!m) return;

    for (let i = 0; i < count; i++) {
      // i번째 비즈의 각도(0~2π)
      const t = (i / count) * Math.PI * 2;

      // 원 위의 위치(x, y, z). y는 살짝 들어올려 시각적 분리
      const x = Math.cos(t) * ringRadius;
      const z = Math.sin(t) * ringRadius;
      const y = 1;

      // 접선 벡터(실이 지나가는 방향). 토러스의 축을 이 방향으로 회전 정렬
      const tangent = new THREE.Vector3(
        -Math.sin(t),
        0,
        Math.cos(t)
      ).normalize();

      // 위치/회전 적용: 토러스의 Y(여기선 upY=Z)축을 접선 방향으로 매칭
      dummy.position.set(x, y, z);
      // 토러스의 Y축(구멍 축)을 접선 방향으로 정렬
      dummy.quaternion.setFromUnitVectors(upY, tangent);

      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, colorArr[i % colorArr.length]);
    }
    // 행렬/색상 버퍼가 갱신되었음을 three에 알림 → 즉시 반영
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
      // 카메라를 비스듬히 위에서 내려다보도록 배치
      camera={{ position: [0, 10, cameraDistance], fov: 35 }}
      dpr={[1, 1.5]}
      // thumbnail 캡처(toBlob) 용으로 보존 버퍼 활성화
      gl={{ preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      {/* 실내 느낌의 반사/환경광 */}
      <Environment preset="city" />
      {/* 회전만 허용, 패닝 비활성화 */}
      <OrbitControls enablePan={false} />
      <BeadRingTorus
        count={count}
        ringRadius={ringRadius}
        // 비즈의 길이감/두께를 토러스 파라미터로 제어
        outer={0.12}
        tube={0.615}
        colors={colors}
      />
    </Canvas>
  );
}
