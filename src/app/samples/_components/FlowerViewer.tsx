"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useLayoutEffect } from "react";

type Props = {
  flowers?: number; // 반지 둘레에 배치할 꽃 개수
  ringRadius?: number; // 반지 반경
  beadOuter?: number; // 비즈(토러스) 대반경
  beadTube?: number; // 비즈 두께
  centerColor?: string; // 중앙 비즈 색
  petalColor?: string; // 꽃잎 비즈 색
  petalOffset?: number; // 중앙↔꽃잎 거리 (꽃 크기)
  phase?: number; // 모든 꽃에 동일 적용할 위상(라디안) - 옆꽃과 꽃잎 맞닿게 조정
};
function BeadFlowerRing({
  flowers = 10,
  ringRadius = 10,
  beadOuter = 0.85,
  beadTube = 0.3,
  centerColor = "#ffd166",
  petalColor = "#ef476f",
  petalOffset = 1.15,
  phase = 0, // 꽃잎이 접선(T)에 정확히 걸리게 하려면 0 또는 Math.PI/6 등으로 조정
}: {
  flowers?: number;
  ringRadius?: number;
  beadOuter?: number;
  beadTube?: number;
  centerColor?: string;
  petalColor?: string;
  petalOffset?: number;
  phase?: number;
}) {
  const geom = useMemo(
    () => new THREE.TorusGeometry(beadOuter, beadTube, 24, 48),
    [beadOuter, beadTube]
  );
  const matCenter = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: centerColor,
        roughness: 0.15,
        transmission: 0.7,
        thickness: 0.6,
        ior: 1.45,
      }),
    [centerColor]
  );
  const matPetal = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: petalColor,
        roughness: 0.15,
        transmission: 0.7,
        thickness: 0.6,
        ior: 1.45,
      }),
    [petalColor]
  );

  const refCenter = useRef<THREE.InstancedMesh>(null);
  const refPetal = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  useLayoutEffect(() => {
    const mC = refCenter.current,
      mP = refPetal.current;
    if (!mC || !mP) return;

    for (let i = 0; i < flowers; i++) {
      const t = (i / flowers) * Math.PI * 2;

      // 반지 위 기준 축
      const P = new THREE.Vector3(
        Math.cos(t) * ringRadius,
        0,
        Math.sin(t) * ringRadius
      );
      const T = new THREE.Vector3(-Math.sin(t), 0, Math.cos(t)).normalize(); // 접선
      const N = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).normalize(); // 정면(바깥쪽)
      const B = new THREE.Vector3().crossVectors(T, N).normalize(); // 수직축

      // ⬇ 꽃의 정면을 N으로: Torus Z축 → N 정렬
      dummy.position.copy(P);
      dummy.quaternion.setFromUnitVectors(zAxis, N);
      dummy.updateMatrix();
      mC.setMatrixAt(i, dummy.matrix);

      // 🌸 꽃잎은 N에 수직인 평면(T,B) 위에 원형 배치
      for (let k = 0; k < 6; k++) {
        const theta = phase + (k / 6) * Math.PI * 2;
        const offset = T.clone()
          .multiplyScalar(Math.cos(theta) * petalOffset)
          .add(B.clone().multiplyScalar(Math.sin(theta) * petalOffset));
        const idx = i * 6 + k;

        dummy.position.copy(P).add(offset);
        dummy.quaternion.setFromUnitVectors(zAxis, N);
        dummy.updateMatrix();
        mP.setMatrixAt(idx, dummy.matrix);
      }
    }

    mC.instanceMatrix.needsUpdate = true;
    mP.instanceMatrix.needsUpdate = true;
  }, [flowers, ringRadius, petalOffset, phase, zAxis]);

  return (
    <>
      <instancedMesh ref={refCenter} args={[geom, matCenter, flowers]} />
      <instancedMesh ref={refPetal} args={[geom, matPetal, flowers * 6]} />
    </>
  );
}

export default function BeadFlowerViewer(props: Props) {
  const {
    flowers = 13,
    ringRadius = 10,
    beadOuter = 0.15,
    beadTube = 0.3,
    centerColor = "#ffd166",
    petalColor = "#ef476f",
    petalOffset = 0.75,
    phase = Math.PI / 2,
  } = props;

  return (
    <Canvas camera={{ position: [0, 10, 24], fov: 35 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} />
      <BeadFlowerRing
        flowers={flowers}
        ringRadius={ringRadius}
        beadOuter={beadOuter}
        beadTube={beadTube}
        centerColor={centerColor}
        petalColor={petalColor}
        petalOffset={petalOffset}
        phase={phase}
      />
    </Canvas>
  );
}
