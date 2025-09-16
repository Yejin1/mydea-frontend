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
  flowers = 15,
  ringRadius = 30,
  beadOuter = 0.85,
  beadTube = 0.3,
  centerColor = "#ffd166",
  petalColor = "#ef476f",
  petalOffset = 1.15,
  phase = 0,
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
  const refBead = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []); // Torus의 구멍 축

  const colors = ["#f09999", "#9dc99f", "#b0bcfc"];
  const colorArr = colors.map((c) => new THREE.Color(c));

  //  옆 비즈 중심 간 간격(월드 단위) → 각도 간격 Δθ
  // (필요 시 prop으로 빼서 튜닝 가능)
  const beadWorldGap = beadOuter * 0.9 + 0.9;
  const beadStepAngle = beadWorldGap / ringRadius; // Δθ
  const beadStartOffset = 0.1;

  useLayoutEffect(() => {
    const mC = refCenter.current,
      mP = refPetal.current,
      mB = refBead.current;
    if (!mC || !mP || !mB) return;

    for (let i = 0; i < flowers; i++) {
      const t = (i / flowers) * Math.PI * 2;

      // 기준 벡터
      const P = new THREE.Vector3(
        Math.cos(t) * ringRadius,
        0,
        Math.sin(t) * ringRadius
      );
      const T = new THREE.Vector3(-Math.sin(t), 0, Math.cos(t)).normalize(); // 접선
      const N = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).normalize(); // 바깥쪽(정면)
      const B = new THREE.Vector3().crossVectors(T, N).normalize(); // 수직축

      // 중앙(정면이 바깥쪽)
      dummy.position.copy(P);
      dummy.quaternion.setFromUnitVectors(zAxis, N); // Z→N
      dummy.updateMatrix();
      mC.setMatrixAt(i, dummy.matrix);

      // 꽃잎: N에 수직인 평면(T,B)
      for (let k = 0; k < 6; k++) {
        const theta = phase + (k / 6) * Math.PI * 2;
        const offset = T.clone()
          .multiplyScalar(Math.cos(theta) * petalOffset)
          .add(B.clone().multiplyScalar(Math.sin(theta) * petalOffset));
        const idx = i * 6 + k;

        dummy.position.copy(P).add(offset);
        dummy.quaternion.setFromUnitVectors(zAxis, N); // Z→N
        dummy.updateMatrix();
        mP.setMatrixAt(idx, dummy.matrix);
      }

      // 비즈: 접선 궤도를 따라 배치 + 구멍 축이 접선으로
      for (let j = 0; j < colorArr.length; j++) {
        const tj = t + beadStartOffset + (j + 1) * beadStepAngle; // 다음 비즈의 각도 (접선 방향으로 전진)
        const Pj = new THREE.Vector3(
          Math.cos(tj) * ringRadius,
          0,
          Math.sin(tj) * ringRadius
        );

        const Tj = new THREE.Vector3(
          -Math.sin(tj),
          0,
          Math.cos(tj)
        ).normalize(); // 그 위치의 접선
        // 위치/회전
        dummy.position.copy(Pj);
        dummy.quaternion.setFromUnitVectors(zAxis, Tj); // Z→T(구멍이 접선 방향)
        dummy.updateMatrix();

        const beadIdx = i * colorArr.length + j;
        mB.setMatrixAt(beadIdx, dummy.matrix);
        mB.setColorAt(beadIdx, colorArr[j]);
      }
    }

    mC.instanceMatrix.needsUpdate = true;
    mP.instanceMatrix.needsUpdate = true;
    mB.instanceMatrix.needsUpdate = true;
    if (refBead.current!.instanceColor)
      refBead.current!.instanceColor.needsUpdate = true;
  }, [
    flowers,
    ringRadius,
    petalOffset,
    phase,
    zAxis,
    beadStepAngle,
    colorArr,
    dummy,
  ]);

  return (
    <>
      <instancedMesh ref={refCenter} args={[geom, matCenter, flowers]} />
      <instancedMesh ref={refPetal} args={[geom, matPetal, flowers * 6]} />
      <instancedMesh
        ref={refBead}
        args={[geom, matCenter, flowers * colorArr.length]}
      />
    </>
  );
}

export default function BeadFlowerViewer(props: Props) {
  const {
    flowers = 9,
    ringRadius = 10,
    beadOuter = 0.15,
    beadTube = 0.6,
    centerColor = "rgba(255, 232, 61, 1)",
    petalColor = "rgba(218, 81, 81, 1)",
    petalOffset = 1.4,
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
