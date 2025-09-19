"use client";
import dynamic from "next/dynamic";

const FlowerViewer = dynamic(() => import("./FlowerViewer"), {
  ssr: false,
  loading: () => null,
});

const BeadsViewer = dynamic(() => import("./BeadsViewer"), {
  ssr: false,
  loading: () => null,
});

type Props = {
  design: "basic" | "flower";
  colors: string[];
  count: number;
  ringRadius: number;
  cameraDistance: number;
  flowers?: number;
  petalColor?: string;
  centerColor?: string;
};

export default function ViewerSwitch({
  design,
  colors,
  count,
  ringRadius,
  cameraDistance,
  flowers,
  petalColor,
  centerColor,
}: Props) {
  if (design === "flower") {
    return (
      <FlowerViewer
        colors={colors}
        count={count}
        ringRadius={ringRadius}
        cameraDistance={cameraDistance}
        flowers={flowers ?? 6}
        petalColor={petalColor ?? "#ffb6c1"}
        centerColor={centerColor ?? "#ffe066"}
      />
    );
  }
  return (
    <BeadsViewer
      colors={colors}
      count={count}
      ringRadius={ringRadius}
      cameraDistance={cameraDistance}
    />
  );
}
