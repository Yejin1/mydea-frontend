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

export default function ViewerSwitch(props: Props) {
  const { design, ...rest } = props;
  if (design === "flower") {
    const { flowers, petalColor, centerColor, ...common } = rest as any;
    return (
      <FlowerViewer
        {...common}
        flowers={flowers || 6}
        petalColor={petalColor || "#ffb6c1"}
        centerColor={centerColor || "#ffe066"}
      />
    );
  }
  const common = rest as any;
  return <BeadsViewer {...common} />;
}
