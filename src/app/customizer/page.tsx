"use client";
import BeadsViewer from "./_components/BeadsViewer";
import BeadFlowerViewer from "./_components/FlowerViewer";
import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./customizer.module.css";
import { PretendardRegular, PretendardExtraBold } from "@/app/fonts";

type Accessory = "ring" | "bracelet" | "necklace";

function CustomizerContent() {
  const search = useSearchParams();
  const initialWorkId = search.get("workId");
  const [countOption, setCountOption] = useState<number[]>([]);
  const [radiusOption, setRadiusOption] = useState<number[]>([]);
  const [sizeOption, setSizeOption] = useState<number[]>([]);

  const [colors, setColors] = useState(["#feadad", "#a1d9a4", "#c6cae0"]);
  const [size, setSize] = useState("small");
  const [radius, setRadius] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [flowersOptions, setFlowersOptions] = useState<number[]>([]);
  // flowers는 현재 파생 옵션에 사용되지 않으므로 제거 (필요 시 복구)
  const flowers = 6;
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const [design, setDesign] = useState<"basic" | "flower">("basic");
  const [saving, setSaving] = useState(false);
  // (saveError/saveSuccess 상태 제거: UI 미사용)
  const [imageUploading, setImageUploading] = useState(false);
  // (imageUploadError 상태 제거: UI 미사용)
  const [imageUploadedUrl, setImageUploadedUrl] = useState<string | null>(null);
  const [savedWorkId, setSavedWorkId] = useState<number | null>(null);
  const [patchingImage, setPatchingImage] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  // originalPreviewUrl: 이전 프리뷰와 변경 비교가 필요해지면 복구
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isEditMode = !!savedWorkId; // savedWorkId 세팅되면 편집 모드로 간주
  const [isLocal, setIsLocal] = useState(false);

  const [flowerColors, setFlowerColors] = useState({
    petal: "#ffb6c1",
    center: "#ffe066",
  });

  const [accessory, setAccessory] = useState<Accessory>("ring");
  const [autoSize, setAutoSize] = useState<number>(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const firstLoadRef = useRef(true);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  // 로드된 작업의 sizeIndex/radius 적용 1회 반영용 refs
  const loadedSizeIndexRef = useRef<number | null>(null);
  const loadedRadiusRef = useRef<number | null>(null);
  const loadedAppliedRef = useRef(false);
  // 최신 옵션 배열 값을 즉시 참조하기 위한 refs (로드 직후 적용용)
  const sizeOptionRef = useRef<number[]>([]);
  const countOptionRef = useRef<number[]>([]);
  const radiusOptionRef = useRef<number[]>([]);

  // 옵션 상태 변경 시 ref 동기화
  useEffect(() => {
    sizeOptionRef.current = sizeOption;
  }, [sizeOption]);
  useEffect(() => {
    countOptionRef.current = countOption;
  }, [countOption]);
  useEffect(() => {
    radiusOptionRef.current = radiusOption;
  }, [radiusOption]);

  // 로컬 환경(호스트네임)에서만 특정 버튼 노출
  useEffect(() => {
    try {
      const host = window.location.hostname;
      setIsLocal(host === "localhost" || host === "127.0.0.1");
    } catch {
      setIsLocal(false);
    }
  }, []);

  // 로드된 sizeIndex 를 즉시 적용 (옵션 이미 계산된 경우)
  const attemptApplyLoadedSelection = () => {
    if (loadedAppliedRef.current) return; // 이미 적용됨
    if (loadedSizeIndexRef.current === null) return; // 적용할 값 없음
    const so = sizeOptionRef.current;
    const co = countOptionRef.current;
    const ro = radiusOptionRef.current;
    if (!so.length || !co.length || !ro.length) return; // 옵션 아직 준비 안됨
    let idx = loadedSizeIndexRef.current;
    if (idx < 0 || idx >= so.length) idx = 0;
    setSelectedIdx(idx);
    setSize(String(so[idx]));
    setCount(co[idx]);
    setRadius(ro[idx]);
    loadedAppliedRef.current = true;
  };

  // 기존 작업 불러오기 (StrictMode 중복 호출 시 AbortError 무시)
  useEffect(() => {
    if (!initialWorkId) return;
    if (savedWorkId) return;
    const controller = new AbortController();
    let finished = false;
    (async () => {
      try {
        setLoadingExisting(true);
        const res = await fetch(`/api/works/${initialWorkId}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status !== 499)
            console.error("[customizer] work load 실패", res.status);
          return;
        }
        const data = await res.json();
        const normalizeAcc = (v: unknown): Accessory | null => {
          const s = String(v).toLowerCase();
          return ["ring", "bracelet", "necklace"].includes(s)
            ? (s as Accessory)
            : null;
        };
        const normalizeDesign = (v: unknown): "basic" | "flower" | null => {
          const s = String(v).toLowerCase();
          if (s === "basic" || s === "flower") return s;
          return null;
        };
        if (data?.id) setSavedWorkId(data.id);
        if (Array.isArray(data?.colors) && data.colors.length > 0)
          setColors(data.colors);
        // 새로운 'accessory' 키와 과거 'workType' 키 모두 허용
        const normAcc = normalizeAcc(data?.accessory ?? data?.workType);
        if (normAcc) setAccessory(normAcc);
        // 새로운 'design' 키와 과거 'designType' 키 모두 허용
        const normDes = normalizeDesign(data?.design ?? data?.designType);
        if (normDes) setDesign(normDes);
        if (data?.flowerColors?.petal || data?.flowerColors?.center) {
          setFlowerColors({
            petal: data?.flowerColors?.petal || "#ffb6c1",
            center: data?.flowerColors?.center || "#ffe066",
          });
        }
        if (typeof data?.sizeIndex === "number")
          loadedSizeIndexRef.current = data.sizeIndex;
        if (typeof data?.autoSize === "number") setAutoSize(data.autoSize);
        if (typeof data?.radiusMm === "number") {
          loadedRadiusRef.current = data.radiusMm;
          setRadius(data.radiusMm);
        }
        if (data?.signedPreviewUrl) {
          setImageUploadedUrl(data.signedPreviewUrl);
        }
        attemptApplyLoadedSelection();
      } catch (e: unknown) {
        if (
          e &&
          typeof e === "object" &&
          "name" in e &&
          (e as { name?: string }).name === "AbortError"
        )
          return;
        console.error("[customizer] load error", e);
      } finally {
        if (!finished) setLoadingExisting(false);
      }
    })();
    return () => {
      finished = true;
      controller.abort();
    };
  }, [initialWorkId, savedWorkId]);

  // 계산에 필요한 상수
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
      return { counts, radii, sizes, auto: sizes[0] ?? 0, flowersArr: [] };
    }

    // 꽃 모드
    // 한 개의 꽃 세그먼트(꽃 + 주변 비즈들)가 차지하는 기본 선형 길이 계산
    const baseLinear = flowerClearanceWorld + colorCount * beadWorldGap; // 기본 길이(L_base)
    const gapRatio = flowerGapRatio; // 간격 비율
    const L_total_per_segment = baseLinear * (1 + gapRatio); // 세그먼트 총 길이 = (꽃 + 비즈) + 간격

    const flowersMin = 4;
    const flowersMax = 40;

    const flowersArr: number[] = [];
    const counts: number[] = [];
    const radii: number[] = [];
    const sizes: number[] = [];

    for (let F = flowersMin; F <= flowersMax; F++) {
      // 일정 간격을 유지하며 선형 길이로부터 이상적인 반지름 계산
      const R_ideal = (L_total_per_segment * F) / (2 * Math.PI);
      // 기존 규칙(count = R * 5)에 맞추어 정수 비즈 개수로 스냅
      const countApprox = Math.round(R_ideal * 5);
      if (countApprox < minCount || countApprox > maxCount) continue;
      const R = countApprox / 5; // 실제 사용되는 스냅된 반지름
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

  // accessory, colors.length, design, flowers 변화시에만 파생 옵션 재계산
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

  // 파생값을 한 번에 반영
  useEffect(() => {
    setCountOption(derived.counts);
    setRadiusOption(derived.radii);
    setSizeOption(derived.sizes);
    setAutoSize(derived.auto);
    if (design === "flower") {
      setFlowersOptions(derived.flowersArr);
    }
  }, [derived, design]);

  // 옵션 배열 갱신 시 초기 선택값 반영 (로드된 작업 있으면 1회 우선 적용)
  useEffect(() => {
    if (
      sizeOption.length === 0 ||
      countOption.length === 0 ||
      radiusOption.length === 0
    )
      return;

    // 로드된 sizeIndex 가 있다면 1회 우선 적용
    if (!loadedAppliedRef.current && loadedSizeIndexRef.current !== null) {
      let idx = loadedSizeIndexRef.current;
      if (idx < 0 || idx >= sizeOption.length) idx = 0;
      setSelectedIdx(idx);
      setSize(String(sizeOption[idx]));
      setCount(countOption[idx]);
      setRadius(radiusOption[idx]);
      loadedAppliedRef.current = true;
      return; // 초기 로드 적용 후 종료
    }

    // 일반 흐름: selectedIdx 범위 보정 후 동기화
    let current = selectedIdx;
    if (current < 0 || current >= sizeOption.length) current = 0;
    setSelectedIdx(current);
    setSize(String(sizeOption[current]));
    setCount(countOption[current]);
    setRadius(radiusOption[current]);
  }, [sizeOption, countOption, radiusOption, selectedIdx]);

  // 사이즈 옵션이 비었을 때 경고 & 선택값 초기화
  useEffect(() => {
    // 최초 로딩 동안(sizeOption 미계산) 경고 방지
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

  // 색상 변경/추가/삭제 핸들러
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

  // cameraDistance: 선택된 사이즈 기반 동적 계산
  const cameraDistance = (() => {
    const numSize = Number(size);
    if (isNaN(numSize)) return 12; // 기본값
    if (numSize > 20) return numSize * 1.2;
    if (numSize > 10) return numSize * 1.5;
    return numSize * 2.2;
  })();

  // three.js 캔버스 스크린샷 업로드
  async function captureAndUploadScreenshot(
    workId?: number | string
  ): Promise<string | null> {
    setImageUploading(true);
    // 이미지 업로드 에러 상태 제거됨 (초기화 불필요)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null))); // 렌더 완료 대기
      const wrapper = canvasWrapperRef.current;
      if (!wrapper) throw new Error("canvas wrapper 없음");
      const canvas = wrapper.querySelector("canvas");
      if (!canvas) throw new Error("canvas 요소 탐색 실패");
      // debug 로그 제거 (canvas size)
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.95)
      );
      if (!blob) throw new Error("toBlob 실패");
      // debug 로그 제거 (blob size)
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
    } catch (e: unknown) {
      console.error("[screenshot] error", e);
      const msg = e instanceof Error ? e.message : "업로드 오류";
      console.error("[customizer] 이미지 업로드 실패", msg);
      return null;
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <div className={styles.pageLayout}>
      {/* 미리보기 */}
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

      {/* 설정 패널 */}
      <div className={`${styles.settingsBox} ${PretendardRegular.className}`}>
        {/* 악세사리 종류 */}
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
            disabled={saving || patchingImage || loadingExisting}
            onClick={async () => {
              try {
                setSaving(true);
                if (!isEditMode) {
                  // 생성
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
                  const createRes = await fetch(`/api/works`, {
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
                  console.log("[customizer] 기본 정보 저장 완료");
                  // 썸네일 업로드
                  setPatchingImage(true);
                  const url = await captureAndUploadScreenshot(newId);
                  if (url) {
                    try {
                      const patchRes = await fetch(
                        `/api/works/${newId}/preview-url`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ previewUrl: url }),
                        }
                      );
                      if (!patchRes.ok) {
                        const t = await patchRes.text();
                        throw new Error(
                          t || `이미지 URL PATCH 실패 ${patchRes.status}`
                        );
                      }
                      console.log("[customizer] 저장 및 썸네일 업로드 완료");
                    } catch (pe: unknown) {
                      const msg =
                        pe instanceof Error
                          ? pe.message
                          : "미리보기 URL 갱신 실패";
                      console.error(
                        "[customizer] 썸네일 업로드 실패 메시지",
                        msg
                      );
                    }
                  } else {
                    console.error(
                      "[customizer] 썸네일 업로드 실패(기본 정보는 저장됨)"
                    );
                  }
                } else {
                  // 수정
                  const id = savedWorkId;
                  if (!id) throw new Error("편집 ID 누락");
                  const patchBody = {
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
                  };
                  //기존 썸네일 보존. 재업로드를 별도 버튼으로 유지.
                  const patchRes = await fetch(`/api/works/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patchBody),
                  });
                  if (!patchRes.ok) {
                    const t = await patchRes.text();
                    throw new Error(t || `편집 PATCH 실패 ${patchRes.status}`);
                  }
                  console.log("[customizer] 변경 사항 저장 완료");

                  // 저장 직후 썸네일 자동 업데이트
                  try {
                    setPatchingImage(true);
                    const newUrl = await captureAndUploadScreenshot(id);
                    if (newUrl) {
                      const resPreview = await fetch(
                        `/api/works/${id}/preview-url`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ previewUrl: newUrl }),
                        }
                      );
                      if (!resPreview.ok) {
                        const t2 = await resPreview.text();
                        throw new Error(
                          t2 || `미리보기 URL 갱신 실패 ${resPreview.status}`
                        );
                      }
                      console.log("[customizer] 썸네일 자동 업데이트 완료");
                    }
                  } catch (thumbErr) {
                    console.error(
                      "[customizer] 썸네일 자동 업데이트 실패",
                      thumbErr
                    );
                  } finally {
                    setPatchingImage(false);
                  }
                }
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "저장 실패";
                console.error("[customizer] 저장 실패 메시지", msg);
              } finally {
                setSaving(false);
                setPatchingImage(false);
              }
            }}
          >
            {loadingExisting
              ? "불러오는 중..."
              : saving
              ? "저장중..."
              : patchingImage
              ? "이미지 반영중..."
              : isEditMode
              ? "변경 저장"
              : "저장하기"}
          </button>
          <button
            type="button"
            className={styles.btnOrder}
            disabled={saving}
            onClick={() => {
              if (saving) return;
              alert("주문 기능은 준비중입니다.");
            }}
          >
            주문하기
          </button>
          {isEditMode && (
            <button
              type="button"
              className={styles.btnDelete}
              disabled={saving || deleting}
              onClick={async () => {
                if (!savedWorkId || deleting) return;
                if (
                  !confirm(
                    "정말 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다."
                  )
                )
                  return;
                try {
                  setDeleteError(null);
                  setDeleting(true);
                  const res = await fetch(`/api/works`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify([savedWorkId]),
                  });
                  if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt || `삭제 실패 (${res.status})`);
                  }
                  // 목록 페이지로 이동
                  window.location.href = "/myworks";
                } catch (pe: unknown) {
                  const msg = pe instanceof Error ? pe.message : "삭제 실패";
                  setDeleteError(msg);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "삭제중..." : "삭제"}
            </button>
          )}
        </div>
        {deleteError && (
          <div style={{ color: "#ff4d4f", fontSize: 12, marginTop: 4 }}>
            {deleteError}
          </div>
        )}
        {isLocal && (
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={
                imageUploading || saving || patchingImage || !savedWorkId
              }
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
                    const patchRes = await fetch(
                      `/api/works/${savedWorkId}/preview-url`,
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
                    console.log("[customizer] 썸네일 재업로드 완료");
                  } catch (pe: unknown) {
                    const msg =
                      pe instanceof Error
                        ? pe.message
                        : "썸네일 PATCH 실패(previewUrl)";
                    console.error("[customizer] 썸네일 재업로드 실패", msg);
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
        )}
      </div>
    </div>
  );
}

export default function CustomizerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>로딩중...</div>}>
      <CustomizerContent />
    </Suspense>
  );
}
