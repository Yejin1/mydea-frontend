"use client";
import BeadsViewer from "./_components/BeadsViewer";
import BeadFlowerViewer from "./_components/FlowerViewer";
import { useEffect, useMemo, useState, useRef } from "react";
import styles from "./customizer.module.css";
import { PretendardRegular, PretendardExtraBold } from "@/app/fonts";

type Accessory = "ring" | "bracelet" | "necklace";

export default function CustomizerPage() {
  const [countOption, setCountOption] = useState<number[]>([]);
  const [radiusOption, setRadiusOption] = useState<number[]>([]);
  const [sizeOption, setSizeOption] = useState<number[]>([]);

  const [colors, setColors] = useState(["#feadad", "#a1d9a4", "#c6cae0"]);
  const [size, setSize] = useState("small");
  const [radius, setRadius] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [flowersOptions, setFlowersOptions] = useState<number[]>([]);
  const [flowers, setFlowers] = useState<number>(6);
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const [design, setDesign] = useState<"basic" | "flower">("basic");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadedUrl, setImageUploadedUrl] = useState<string | null>(null);
  const [savedWorkId, setSavedWorkId] = useState<number | null>(null);
  const [patchingImage, setPatchingImage] = useState(false);

  const [flowerColors, setFlowerColors] = useState({
    petal: "#ffb6c1",
    center: "#ffe066",
  });

  const [accessory, setAccessory] = useState<Accessory>("ring");
  const [autoSize, setAutoSize] = useState<number>(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const firstLoadRef = useRef(true);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const beadOuter = 0.15;
  const gapPadding = 0.9;
  const beadWorldGap = 2 * beadOuter + gapPadding;

  const petalOffset = 1.4;
  const clearanceMargin = 0.2;
  const flowerClearanceWorld = petalOffset + beadOuter + clearanceMargin;

  const flowerGapRatio = 0.3;

  function computeOptions(
    acc: "ring" | "bracelet" | "necklace",
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
      const R0 = radii[0] ?? 0;
      return {
        counts,
        radii,
        sizes,
        auto: sizes[0] ?? 0,
        flowersArr: [],
      };
    }

    // 꽃 모드
    // 한 개의 꽃 세그먼트(꽃 + 그 주변 비즈들)가 차지하는 기본 선형 길이
    const baseLinear = flowerClearanceWorld + colorCount * beadWorldGap; // 기본 길이(L_base)
    const gapRatio = flowerGapRatio; // 조정 가능한 간격 비율
    const L_total_per_segment = baseLinear * (1 + gapRatio); // 세그먼트 총 길이 = (꽃 + 비즈) + 간격

    const flowersMin = 4;
    const flowersMax = 40;

    const flowersArr: number[] = [];
    const counts: number[] = [];
    const radii: number[] = [];
    const sizes: number[] = [];

    for (let F = flowersMin; F <= flowersMax; F++) {
      // Ideal radius from linear segmentation (uniform gap maintained)
      const R_ideal = (L_total_per_segment * F) / (2 * Math.PI);
      // Snap to discrete count (count = R * 5) per existing rule
      const countApprox = Math.round(R_ideal * 5);
      if (countApprox < minCount || countApprox > maxCount) continue;
      const R = countApprox / 5; // snapped radius actually used
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

  //accessory, colors.length 변화시에만 파생 옵션 재계산
  const derived = useMemo(
    () =>
      computeOptions(
        accessory, // "ring" | "bracelet" | "necklace"
        colors.length, // colorCount
        design, // "basic" | "flower"
        flowers, // 패턴 반복(꽃 개수)
        beadWorldGap,
        flowerClearanceWorld
      ),
    [
      accessory,
      colors.length,
      design,
      flowers,
      beadWorldGap,
      flowerClearanceWorld,
    ]
  );

  // 파생값을 한 번에 교체
  useEffect(() => {
    setCountOption(derived.counts);
    setRadiusOption(derived.radii);
    setSizeOption(derived.sizes);
    setAutoSize(derived.auto);
    if (design === "flower") {
      setFlowersOptions(derived.flowersArr);
    }
  }, [derived, design]);

  // 옵션 배열이 바뀔 때마다 첫 번째 값 자동 세팅
  useEffect(() => {
    if (
      sizeOption.length > 0 &&
      countOption.length > 0 &&
      radiusOption.length > 0
    ) {
      setSize(String(sizeOption[0]));
      setSelectedIdx(0);
      setCount(countOption[0]);
      setRadius(radiusOption[0]);
    }
  }, [sizeOption, countOption, radiusOption]);

  useEffect(() => {
    if (design === "flower") return; // 기본 모드에서만 실행
    const newSizeOptions: number[] = [];
    // 예시: 악세사리 종류와 색상 개수에 따라 옵션 생성
    let minCount = 24,
      maxCount = 36;
    if (accessory === "bracelet") {
      minCount = 90;
      maxCount = 126;
    }
    if (accessory === "necklace") {
      minCount = 228;
      maxCount = 282;
    }
    let cnt = minCount;
    if (cnt % colors.length !== 0)
      cnt = Math.ceil(minCount / colors.length) * colors.length;
    for (; cnt <= maxCount; cnt += colors.length) {
      newSizeOptions.push(Math.round((cnt * 5) / 3));
    }
    setSizeOption(newSizeOptions);
  }, [accessory, colors.length, design]);

  // 사이즈 옵션이 비었을 때 경고 & 선택값 초기화
  useEffect(() => {
    // 최초 로딩 동안(sizeOption 아직 미계산) 경고 방지
    if (firstLoadRef.current) {
      if (sizeOption.length === 0) return; // 아직 계산 안 됨 → 그냥 대기
      firstLoadRef.current = false; // 한 번이라도 값이 들어오면 이후부터 감시
    }

    if (sizeOption.length === 0) {
      setSize("");
      setSelectedIdx(-1);
      setCount(0);
      setRadius(0);
      if (typeof window !== "undefined") {
        alert("가능한 사이즈가 없습니다.\n색상을 추가하거나 삭제해주세요");
      }
      return;
    }

    const idx = sizeOption.findIndex((v) => String(v) === size);
    if (idx === -1) {
      setSize(String(sizeOption[0]));
      setSelectedIdx(0);
      setCount(countOption[0]);
      setRadius(radiusOption[0]);
    }
  }, [sizeOption, size, countOption, radiusOption]);

  // 색상 핸들러
  const handleColorChange = (idx: number, value: string) => {
    setColors((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };
  const addColor = () => {
    if (colors.length < 7) setColors((prev) => [...prev, "#ffffff"]);
  };
  const removeColor = (idx: number) => {
    if (colors.length > 1)
      setColors((prev) => prev.filter((_, i) => i !== idx));
  };

  // cameraDistance 계산: 선택된 사이즈 값에 따라 동적으로 설정
  const cameraDistance = (() => {
    const numSize = Number(size);
    if (isNaN(numSize)) return 12; // 기본값
    if (numSize > 20) return numSize * 1.2;
    if (numSize > 10) return numSize * 1.5;
    return numSize * 2.2;
  })();

  // three.js 캔버스 스크린샷 -> 서버 API (/api/upload) -> Azure (server-side)
  async function captureAndUploadScreenshot(
    workId?: number | string
  ): Promise<string | null> {
    setImageUploading(true);
    setImageUploadError(null);
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null))); // 렌더 완료 대기
      const wrapper = canvasWrapperRef.current;
      if (!wrapper) throw new Error("canvas wrapper 없음");
      const canvas = wrapper.querySelector("canvas");
      if (!canvas) throw new Error("canvas 요소 탐색 실패");
      console.log("[screenshot] canvas size", canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.95)
      );
      if (!blob) throw new Error("toBlob 실패");
      console.log("[screenshot] blob size", blob.size);
      const form = new FormData();
      form.append("file", blob, "capture.png");
      if (workId !== undefined && workId !== null) {
        form.append("workId", String(workId));
      }
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`업로드 실패 ${res.status}: ${txt}`);
      }
      const data = await res.json();
      if (!data?.url) throw new Error("응답 url 누락");
      setImageUploadedUrl(data.url);
      return data.url as string;
    } catch (e: any) {
      console.error("[screenshot] error", e);
      setImageUploadError(e.message || "업로드 오류");
      return null;
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <div className={styles.pageLayout}>
      {/* 왼쪽 BeadsViewer */}
      <div className={`${styles.canvasArea}`} ref={canvasWrapperRef}>
        {design === "flower" ? (
          <BeadFlowerViewer
            colors={colors}
            count={count}
            flowers={flowersOptions[selectedIdx] || 6}
            ringRadius={radius}
            petalColor={flowerColors.petal}
            centerColor={flowerColors.center}
            cameraDistance={cameraDistance}
          />
        ) : (
          <BeadsViewer
            colors={colors}
            count={count}
            ringRadius={radius}
            cameraDistance={cameraDistance}
          />
        )}
      </div>

      {/* 오른쪽 설정 박스 */}
      <div className={`${styles.settingsBox} ${PretendardRegular.className}`}>
        {/* 악세사리 종류 선택 */}
        <div className={styles.rowAccessory}>
          <label
            className={`${PretendardExtraBold.variable} ${styles.labelStrong}`}
          >
            악세사리
          </label>
          <div className={styles.radioGroupInline}>
            <label>
              <input
                type="radio"
                name="accessory"
                value="ring"
                checked={accessory === "ring"}
                onChange={() => setAccessory("ring")}
              />{" "}
              반지
            </label>
            <label>
              <input
                type="radio"
                name="accessory"
                value="bracelet"
                checked={accessory === "bracelet"}
                onChange={() => setAccessory("bracelet")}
              />{" "}
              팔찌
            </label>
            <label>
              <input
                type="radio"
                name="accessory"
                value="necklace"
                checked={accessory === "necklace"}
                onChange={() => setAccessory("necklace")}
              />{" "}
              목걸이
            </label>
          </div>
        </div>

        {/* 데코 타입 */}
        <div className={styles.designRadioGroup}>
          <label
            className={`${PretendardExtraBold.variable} ${styles.labelStrongInline}`}
          >
            데코 타입
          </label>
          <button
            type="button"
            className={
              design === "basic"
                ? `${styles.designRadioBtn} ${styles.selected}`
                : styles.designRadioBtn
            }
            onClick={() => setDesign("basic")}
          >
            기본
          </button>
          <button
            type="button"
            className={
              design === "flower"
                ? `${styles.designRadioBtn} ${styles.selected}`
                : styles.designRadioBtn
            }
            onClick={() => setDesign("flower")}
          >
            꽃
          </button>
        </div>

        {/* 꽃 옵션 */}
        {design === "flower" && (
          <div className={styles.flowerOptions}>
            <div className={styles.colorRow}>
              <label
                className={`${PretendardExtraBold.variable} ${styles.labelStrong}`}
              >
                꽃잎 색상
              </label>
              <input
                type="color"
                value={flowerColors.petal}
                onChange={(e) =>
                  setFlowerColors({ ...flowerColors, petal: e.target.value })
                }
                className={styles.colorInputSmall}
              />
            </div>
            <div className={styles.colorRow}>
              <label
                className={`${PretendardExtraBold.variable} ${styles.labelStrong}`}
              >
                중앙 색상
              </label>
              <input
                type="color"
                value={flowerColors.center}
                onChange={(e) =>
                  setFlowerColors({ ...flowerColors, center: e.target.value })
                }
                className={styles.colorInputSmall}
              />
            </div>
          </div>
        )}

        {/* 색상 선택 */}
        <div className={styles.colorsSection}>
          <label
            className={`${PretendardExtraBold.variable} ${styles.labelStrongInline}`}
          >
            색상 선택
            <span className={styles.tooltipWrapper}>
              <span
                className={styles.infoIcon}
                onMouseEnter={() => setTooltipIdx(0)}
                onMouseLeave={() => setTooltipIdx(null)}
              >
                i
              </span>
              <span
                className={styles.infoTooltip}
                style={{ display: tooltipIdx === 0 ? "block" : "none" }}
              >
                최소 1개, 최대 7개까지 색상을 추가할 수 있습니다.
              </span>
            </span>
          </label>

          {colors.map((color, idx) => (
            <div key={idx} className={styles.colorRow}>
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(idx, e.target.value)}
                className={styles.colorInput}
              />
              <button
                type="button"
                onClick={addColor}
                disabled={colors.length >= 7}
                className={styles.colorBtn}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeColor(idx)}
                disabled={colors.length <= 1}
                className={styles.colorBtn}
              >
                -
              </button>
            </div>
          ))}
        </div>

        {/* 사이즈 선택 */}
        <div className={styles.sizeSection}>
          <label
            className={`${styles.sizeLabel} ${PretendardExtraBold.variable} ${styles.labelStrongInline}`}
          >
            사이즈
            <span className={styles.tooltipWrapper}>
              <span
                className={styles.infoIcon}
                onMouseEnter={() => setTooltipIdx(1)}
                onMouseLeave={() => setTooltipIdx(null)}
              >
                i
              </span>
              <span
                className={styles.infoTooltip}
                style={{ display: tooltipIdx === 1 ? "block" : "none" }}
              >
                사이즈는 선택한 색상 개수에 따라 자동 계산되며, 수작업 특성에
                따라 약간의 오차가 발생할 수 있습니다.
                <br />
                (반지의 경우 ±0.3cm, 목걸이·팔찌의 경우 ±1cm)
              </span>
            </span>
          </label>
          <div className={styles.sizeSelectWrap}>
            <select
              value={size}
              onChange={(e) => {
                const idx = sizeOption.findIndex(
                  (opt) => String(opt) === e.target.value
                );
                setSize(e.target.value);
                setSelectedIdx(idx);
                setCount(countOption[idx]);
                setRadius(radiusOption[idx]);
              }}
              className={styles.sizeSelect}
            >
              {sizeOption.map((opt, idx) => (
                <option key={idx} value={String(opt)}>
                  {opt}mm
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.actionButtons}>
          <button
            type="button"
            className={styles.btnSave}
            disabled={saving || patchingImage}
            onClick={async () => {
              setSaveError(null);
              setSaveSuccess(null);
              setImageUploadError(null);
              try {
                setSaving(true);
                const base =
                  process.env.NEXT_PUBLIC_API_BASE_URL ||
                  "http://localhost:8080";
                // 1) 이미지 없이 work 생성
                const createPayload = {
                  userId: 1,
                  name: `${design === "flower" ? "플라워" : "베이직"} ${
                    accessory === "ring"
                      ? "반지"
                      : accessory === "bracelet"
                      ? "팔찌"
                      : "목걸이"
                  }`,
                  workType: accessory,
                  designType: design,
                  colors: colors,
                  flowerPetal: flowerColors.petal,
                  flowerCenter: flowerColors.center,
                  autoSize: autoSize,
                  radiusMm: radius,
                  sizeIndex: selectedIdx,
                  previewUrl: null,
                };
                const createRes = await fetch(`${base}/api/works`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(createPayload),
                });
                if (!createRes.ok) {
                  const txt = await createRes.text();
                  throw new Error(
                    txt || `Work 생성 실패 HTTP ${createRes.status}`
                  );
                }
                const created = await createRes.json();
                const newId = created?.id;
                if (!newId) throw new Error("생성된 work id 없음");
                setSavedWorkId(newId);
                setSaveSuccess("기본 정보 저장 완료");

                // 2) 캔버스 업로드 (workId 기반 파일명)
                setPatchingImage(true);
                const url = await captureAndUploadScreenshot(newId);
                if (url) {
                  // 3) PATCH 로 previewUrl 업데이트 (백엔드에 PATCH 존재 가정)
                  try {
                    const patchRes = await fetch(`${base}/api/works/${newId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ previewUrl: url }),
                    });
                    if (!patchRes.ok) {
                      const t = await patchRes.text();
                      throw new Error(
                        t || `이미지 URL PATCH 실패 ${patchRes.status}`
                      );
                    }
                    setSaveSuccess("저장 및 썸네일 업로드 완료");
                  } catch (pe: any) {
                    setSaveError(pe.message || "미리보기 URL 갱신 실패");
                  }
                } else {
                  setSaveError("썸네일 업로드 실패(기본 정보는 저장됨)");
                }
              } catch (e: any) {
                setSaveError(e.message || "저장 실패");
              } finally {
                setSaving(false);
                setPatchingImage(false);
              }
            }}
          >
            {saving
              ? "저장중..."
              : patchingImage
              ? "이미지 반영중..."
              : "저장하기"}
          </button>
          <button type="button" className={styles.btnOrder} disabled={saving}>
            주문하기
          </button>
        </div>
        {/* 메시지 출력 제거됨 */}
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={imageUploading || saving || patchingImage || !savedWorkId}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
            onClick={async () => {
              if (!savedWorkId) return;
              const url = await captureAndUploadScreenshot(savedWorkId);
              if (url) {
                // 선택적으로 PATCH 재시도
                try {
                  setPatchingImage(true);
                  const base =
                    process.env.NEXT_PUBLIC_API_BASE_URL ||
                    "http://localhost:8080";
                  const patchRes = await fetch(
                    `${base}/api/works/${savedWorkId}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ previewUrl: url }),
                    }
                  );
                  if (!patchRes.ok) {
                    const t = await patchRes.text();
                    throw new Error(t || `PATCH 실패 ${patchRes.status}`);
                  }
                  setSaveSuccess("썸네일 재업로드 완료");
                  setSaveError(null);
                } catch (pe: any) {
                  setSaveError(pe.message || "썸네일 PATCH 실패(previewUrl)");
                } finally {
                  setPatchingImage(false);
                }
              }
            }}
          >
            썸네일 재업로드
          </button>
          <button
            type="button"
            disabled={imageUploading || saving || !imageUploadedUrl}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
            onClick={() =>
              imageUploadedUrl && window.open(imageUploadedUrl, "_blank")
            }
          >
            업로드 이미지 열기
          </button>
        </div>
      </div>
    </div>
  );
}
