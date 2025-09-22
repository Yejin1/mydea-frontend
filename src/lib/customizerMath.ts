export const BEAD_OUTER = 0.15;
export const GAP_PADDING = 0.9;
export const PETAL_OFFSET = 1.4;
export const CLEARANCE_MARGIN = 0.2;
export const FLOWER_GAP_RATIO = 0.3;

export type Accessory = "ring" | "bracelet" | "necklace";
export type Design = "basic" | "flower";

// 악세사리 종류별, 데코 타입별 기본 가격
export const ACCESSORY_PRICE: Record<Accessory, Record<Design, number>> = {
  ring: {
    basic: 3000, // 반지 기본
    flower: 5000, // 반지 꽃
  },
  bracelet: {
    basic: 5000, // 팔찌 기본
    flower: 8000, // 팔찌 꽃
  },
  necklace: {
    basic: 10000, // 목걸이 기본
    flower: 15000, // 목걸이 꽃
  },
};

export function getAccessoryPrice(
  acc: Accessory,
  design: Design = "basic"
): number {
  return ACCESSORY_PRICE[acc][design];
}

//기준(mm) 초과분에 대해 1m(1000mm) 당 100원 비례 부과
export const SURCHARGE_PER_MM = 100; // 1mm 당 추가요금
export const ACCESSORY_SURCHARGE_THRESHOLDS: Record<Accessory, number> = {
  ring: 48,
  bracelet: 175,
  necklace: 420,
};

export function getAccessoryTotalPrice(
  acc: Accessory,
  sizeMm: number,
  design: "basic" | "flower"
): number {
  const base = getAccessoryPrice(acc, design);
  const threshold = ACCESSORY_SURCHARGE_THRESHOLDS[acc] ?? 0;
  const excessMm = Math.max(0, (sizeMm || 0) - threshold);
  const surcharge = excessMm * SURCHARGE_PER_MM;
  return base + surcharge;
}

export function computeOptions(
  acc: Accessory,
  colorCount: number,
  design: "basic" | "flower",
  flowersBase: number,
  beadWorldGap: number,
  flowerClearanceWorld: number
) {
  let minCount = 24,
    maxCount = 36;
  if (acc === "bracelet") {
    minCount = 90;
    maxCount = 126;
  }
  if (acc === "necklace") {
    minCount = 228;
    maxCount = 282;
  }

  const countToRadius = (count: number) => count / 5;
  const countToSizeMm = (count: number) => Math.round((count * 5) / 3);

  if (design === "basic") {
    const patternLen = Math.max(1, colorCount);
    const start = Math.ceil(minCount / patternLen) * patternLen;
    const counts: number[] = [];
    for (let c = start; c <= maxCount; c += patternLen) counts.push(c);
    const radii = counts.map(countToRadius);
    const sizes = counts.map(countToSizeMm);
    return { counts, radii, sizes, auto: sizes[0] ?? 0, flowersArr: [] };
  }

  // flower design
  const baseLinear = flowerClearanceWorld + colorCount * beadWorldGap;
  const gapRatio = FLOWER_GAP_RATIO;
  const L_total_per_segment = baseLinear * (1 + gapRatio);

  const flowersMin = 4;
  const flowersMax = 40;

  const flowersArr: number[] = [];
  const counts: number[] = [];
  const radii: number[] = [];
  const sizes: number[] = [];

  for (let F = flowersMin; F <= flowersMax; F++) {
    const R_ideal = (L_total_per_segment * F) / (2 * Math.PI);
    const countApprox = Math.round(R_ideal * 5);
    if (countApprox < minCount || countApprox > maxCount) continue;
    const R = countApprox / 5;
    const sizeMm = countToSizeMm(countApprox);
    flowersArr.push(F);
    counts.push(countApprox);
    radii.push(R);
    sizes.push(sizeMm);
  }

  return {
    counts,
    radii,
    sizes,
    auto: sizes[0] ?? 0,
    flowersArr,
  };
}
