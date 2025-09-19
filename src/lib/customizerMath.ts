export const BEAD_OUTER = 0.15;
export const GAP_PADDING = 0.9;
export const PETAL_OFFSET = 1.4;
export const CLEARANCE_MARGIN = 0.2;
export const FLOWER_GAP_RATIO = 0.3;

export type Accessory = "ring" | "bracelet" | "necklace";

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
