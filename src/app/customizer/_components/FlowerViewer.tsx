"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef, useLayoutEffect } from "react";

type Props = {
  colors?: string[];
  flowers?: number;
  count?: number;
  ringRadius?: number;
  petalColor?: string;
  centerColor?: string;
  flowerPosition?: "center" | "repeat";
  cameraDistance?: number;
};
function BeadFlowerRing({
  flowers = 12,
  ringRadius = 10,
  beadOuter = 0.15, // 토러스 대반경(비즈 '반폭' 근사)
  beadTube = 0.6,
  centerColor = "#ffd166",
  petalColor = "#ef476f",
  petalOffset = 1.4, // 꽃 중심→꽃잎 거리
  phase = Math.PI / 2,
  colors = ["#f09999", "#9dc99f", "#b0bcfc"],
  gapScale = 1.05, // 공백각 스케일(1.0이면 '최대한 균일', 0.8이면 좀 더 촘촘)
}: {
  flowers?: number;
  ringRadius?: number;
  beadOuter?: number;
  beadTube?: number;
  centerColor?: string;
  petalColor?: string;
  petalOffset?: number;
  phase?: number;
  colors?: string[];
  gapScale?: number;
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
  const matBead = useMemo(
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

  const refCenter = useRef<THREE.InstancedMesh>(null);
  const refPetal = useRef<THREE.InstancedMesh>(null);
  const refBead = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const colorArr = useMemo(
    () => colors.map((c) => new THREE.Color(c)),
    [colors]
  );

  useLayoutEffect(() => {
    const mC = refCenter.current,
      mP = refPetal.current,
      mB = refBead.current;
    if (!mC || !mP || !mB) return;

    const segmentAng = (Math.PI * 2) / flowers; // 한 세그먼트(꽃→다음꽃)
    const beadHalfAng = beadOuter / ringRadius; // 비즈 반각(접선 방향 폭)
    const flowerHalfAng = (petalOffset + beadOuter) / ringRadius; // 꽃 반각(대략)

    const beadCount = colorArr.length;

    // 공백각 G: 세그먼트 = 2*flowerHalf + 2*beadHalf*개수 + (개수+1)*G
    let gapAng =
      (segmentAng - 2 * flowerHalfAng - 2 * beadHalfAng * beadCount) /
      (beadCount + 1);
    if (!isFinite(gapAng)) gapAng = 0;
    gapAng = Math.max(0, gapAng) * gapScale; // 살짝 조절용 스케일

    for (let f = 0; f < flowers; f++) {
      const segStart = f * segmentAng;

      // 1) 꽃 중심(세그먼트 로컬) = flowerHalf + 좌/우 여유를 중앙정렬로 보정
      const usedAng =
        2 * flowerHalfAng +
        2 * beadHalfAng * beadCount +
        (beadCount + 1) * gapAng;
      const offset = (segmentAng - usedAng) / 2; // 중앙정렬
      const flowerCenterLocal = offset + flowerHalfAng;
      const fa = segStart + flowerCenterLocal;

      // 전역 위치/회전 벡터
      const P = new THREE.Vector3(
        Math.cos(fa) * ringRadius,
        0,
        Math.sin(fa) * ringRadius
      );
      const T = new THREE.Vector3(-Math.sin(fa), 0, Math.cos(fa)).normalize();
      const N = new THREE.Vector3(Math.cos(fa), 0, Math.sin(fa)).normalize();
      const B = new THREE.Vector3().crossVectors(T, N).normalize();

      // 꽃 중심
      dummy.position.copy(P);
      dummy.quaternion.setFromUnitVectors(zAxis, N);
      dummy.updateMatrix();
      mC.setMatrixAt(f, dummy.matrix);

      // 꽃잎 6개
      for (let k = 0; k < 6; k++) {
        const theta = phase + (k / 6) * Math.PI * 2;
        const offsetT = T.clone().multiplyScalar(Math.cos(theta) * petalOffset);
        const offsetB = B.clone().multiplyScalar(Math.sin(theta) * petalOffset);
        const idx = f * 6 + k;
        dummy.position.copy(P).add(offsetT).add(offsetB);
        dummy.quaternion.setFromUnitVectors(zAxis, N);
        dummy.updateMatrix();
        mP.setMatrixAt(idx, dummy.matrix);
      }

      // 2) 비즈들: 이전 중심 + 이전반각 + gap + 이번반각
      let centerLocal = flowerCenterLocal; // 직전 중심(초기: 꽃)
      let prevHalf = flowerHalfAng;
      for (let j = 0; j < beadCount; j++) {
        centerLocal = centerLocal + prevHalf + gapAng + beadHalfAng;
        const ba = segStart + centerLocal;

        const Pj = new THREE.Vector3(
          Math.cos(ba) * ringRadius,
          0,
          Math.sin(ba) * ringRadius
        );
        const Tj = new THREE.Vector3(
          -Math.sin(ba),
          0,
          Math.cos(ba)
        ).normalize();

        dummy.position.copy(Pj);
        dummy.quaternion.setFromUnitVectors(zAxis, Tj);
        dummy.updateMatrix();

        const beadIdx = f * beadCount + j;
        mB.setMatrixAt(beadIdx, dummy.matrix);
        mB.setColorAt(beadIdx, colorArr[j]);
        console.log(colorArr[j]);

        prevHalf = beadHalfAng; // 다음 루프부터는 '이전'이 비즈
      }
    }

    mC.instanceMatrix.needsUpdate = true;
    mP.instanceMatrix.needsUpdate = true;
    mB.instanceMatrix.needsUpdate = true;
    if (refBead.current?.instanceColor)
      refBead.current.instanceColor.needsUpdate = true;
  }, [flowers, ringRadius, beadOuter, petalOffset, phase, colorArr, zAxis]);

  return (
    <>
      <instancedMesh ref={refCenter} args={[geom, matCenter, flowers]} />
      <instancedMesh ref={refPetal} args={[geom, matPetal, flowers * 6]} />
      <instancedMesh
        ref={refBead}
        args={[geom, matBead, flowers * colors.length]}
      />
    </>
  );
}

export default function BeadFlowerViewer({
  colors = ["#f09999", "#9dc99f", "#b0bcfc"],
  count = 8,
  flowers = 3,
  ringRadius = 10,
  petalColor = "rgba(218, 81, 81, 1)",
  centerColor = "rgba(255, 232, 61, 1)",
  cameraDistance = 24,
}: Props) {
  return (
    <Canvas
      camera={{ position: [0, 10, cameraDistance], fov: 35 }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} />
      <BeadFlowerRing
        flowers={flowers}
        ringRadius={ringRadius}
        beadOuter={0.15}
        beadTube={0.6}
        centerColor={centerColor}
        petalColor={petalColor}
        petalOffset={1.4}
        phase={Math.PI / 2}
        colors={colors}
      />
    </Canvas>
  );
}
