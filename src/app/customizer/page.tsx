"use client";
import ViewerSwitch from "./_components/ViewerSwitch";
import SettingsPanel from "./_components/SettingsPanel";
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  Suspense,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
import styles from "./customizer.module.css";
import {
  BEAD_OUTER,
  GAP_PADDING,
  PETAL_OFFSET,
  CLEARANCE_MARGIN,
  computeOptions,
  getAccessoryTotalPrice,
} from "@/lib/customizerMath";

type Accessory = "ring" | "bracelet" | "necklace";

// ---- 타입 정의 -----------------------------------------------------
interface WorkPayloadBase {
  name: string;
  workType: Accessory;
  designType: "basic" | "flower";
  colors: string[];
  flowerPetal: string;
  flowerCenter: string;
  autoSize: number;
  radiusMm: number;
  sizeIndex: number;
}
interface WorkCreatePayload extends WorkPayloadBase {
  previewUrl: string | null;
}
interface CartPayload {
  workId: number;
  name: string;
  thumbUrl: string | null;
  unitPrice: number;
  quantity: number;
  optionHash: string;
}

// ---- 유틸 함수 -----------------------------------------------------
function generateWorkName(design: "basic" | "flower", accessory: Accessory) {
  const designLabel = design === "flower" ? "플라워" : "베이직";
  const accLabel =
    accessory === "ring"
      ? "반지"
      : accessory === "bracelet"
      ? "팔찌"
      : "목걸이";
  return `${designLabel} ${accLabel}`;
}

function buildWorkPayload(
  design: "basic" | "flower",
  accessory: Accessory,
  colors: string[],
  flowerColors: { petal: string; center: string },
  autoSize: number,
  radius: number,
  sizeOption: number[],
  size: string
): WorkPayloadBase {
  return {
    name: generateWorkName(design, accessory),
    workType: accessory,
    designType: design,
    colors,
    flowerPetal: flowerColors.petal,
    flowerCenter: flowerColors.center,
    autoSize,
    radiusMm: radius,
    sizeIndex: sizeOption.findIndex((v) => String(v) === size),
  };
}

function buildCreatePayload(base: WorkPayloadBase): WorkCreatePayload {
  return { ...base, previewUrl: null };
}

function buildCartOptionHash(params: {
  accessory: Accessory;
  design: "basic" | "flower";
  colors: string[];
  flowerColors: { petal: string; center: string };
  size: string;
  sizeOption: number[];
  count: number;
  radius: number;
  flowers: number | null;
}): string {
  const {
    accessory,
    design,
    colors,
    flowerColors,
    size,
    sizeOption,
    count,
    radius,
    flowers,
  } = params;
  const sizeIndex = sizeOption.findIndex((v) => String(v) === size);
  return JSON.stringify({
    accessory,
    design,
    colors,
    flowerColors,
    sizeMm: Number(size) || 0,
    sizeIndex,
    count,
    radiusMm: radius,
    flowers,
  });
}

function deriveCameraDistance(sizeStr: string): number {
  const num = Number(sizeStr);
  if (isNaN(num)) return 12;
  if (num > 20) return num * 1.2;
  if (num > 10) return num * 1.5;
  return num * 2.2;
}

function CustomizerContent() {
  const search = useSearchParams();
  const initialWorkId = search.get("workId");
  const isPresetMode = (search.get("preset") || "").toLowerCase() === "true";
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
  // const [tooltipIdx, setTooltipIdx] = useState<number | null>(null); // unused state removed
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
  // selectedIdx state removed; index derived from size when needed
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
    // index derived from sizeOption later
    setSize(String(so[idx]));
    setCount(co[idx]);
    setRadius(ro[idx]);
    loadedAppliedRef.current = true;
  };

  // 마운트 시 인증 확인 (미인증이면 로그인으로 유도)
  // 인증 확인은 개별 API 호출에서 401 처리(자동 refresh → 실패 시 로그인 리다이렉트)

  // 공통 fetch 래퍼: 401 → refresh → 재시도 → 여전히 401이면 로그인 이동 (상단 의존 useEffect 보다 먼저 선언)
  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      if (res.status !== 401) return res;
      const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
      if (refreshed.ok) {
        const retry = await fetch(input, init);
        if (retry.status !== 401) return retry;
      }
      if (typeof window !== "undefined") {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.href = `/login?next=${next}`;
      }
      return res;
    },
    []
  );

  // 기존 작업 또는 프리셋 불러오기 (StrictMode 중복 호출 시 AbortError 무시)
  useEffect(() => {
    if (!initialWorkId) return;
    if (savedWorkId) return; // 이미 생성/편집 모드 전환됨
    const controller = new AbortController();
    let finished = false;
    (async () => {
      try {
        setLoadingExisting(true);
        const endpoint = isPresetMode
          ? `/api/works/${initialWorkId}/preset`
          : `/api/works/${initialWorkId}`;
        const res = await apiFetch(endpoint, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status !== 499)
            console.error(
              isPresetMode
                ? "[customizer] preset load 실패"
                : "[customizer] work load 실패",
              res.status
            );
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
        // preset 모드에서는 기존 ID를 저장하지 않음 → 항상 신규 생성 흐름
        if (!isPresetMode && data?.id) setSavedWorkId(data.id);
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
  }, [initialWorkId, savedWorkId, isPresetMode, apiFetch]);

  // 계산에 필요한 상수 (util에서 가져옴)
  const beadWorldGap = 2 * BEAD_OUTER + GAP_PADDING;
  const flowerClearanceWorld = PETAL_OFFSET + BEAD_OUTER + CLEARANCE_MARGIN;

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
      setSize(String(sizeOption[idx]));
      setCount(countOption[idx]);
      setRadius(radiusOption[idx]);
      loadedAppliedRef.current = true;
      return; // 초기 로드 적용 후 종료
    }

    // 일반 흐름: selectedIdx 범위 보정 후 동기화
    const currentIdx = sizeOption.findIndex((v) => String(v) === size);
    const applyIdx = currentIdx >= 0 ? currentIdx : 0;
    setSize(String(sizeOption[applyIdx]));
    setCount(countOption[applyIdx]);
    setRadius(radiusOption[applyIdx]);
  }, [sizeOption, countOption, radiusOption, size]);

  // 사이즈 옵션이 비었을 때 경고 & 선택값 초기화
  useEffect(() => {
    // 최초 로딩 동안(sizeOption 미계산) 경고 방지
    if (firstLoadRef.current) {
      if (sizeOption.length === 0) return; // 아직 계산 안 됨 → 그냥 대기
      firstLoadRef.current = false; // 한 번이라도 값이 들어오면 이후부터 감시
    }

    if (sizeOption.length === 0) {
      setSize("");
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

  // cameraDistance 계산 (유틸 함수로 추출)
  const cameraDistance = deriveCameraDistance(size);

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

  // (apiFetch 정의 위치 조정됨)

  // work 생성 또는 존재 보장
  const ensureWorkCreated = useCallback(async (): Promise<number> => {
    let workId = savedWorkId;
    if (workId) return workId;
    setSaving(true);
    const basePayload = buildWorkPayload(
      design,
      accessory,
      colors,
      flowerColors,
      autoSize,
      radius,
      sizeOption,
      size
    );
    const createRes = await apiFetch(`/api/works`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCreatePayload(basePayload)),
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error(txt || `Work 생성 실패 HTTP ${createRes.status}`);
    }
    const created = await createRes.json();
    workId = created?.id;
    if (!workId) throw new Error("생성된 work id 없음");
    setSavedWorkId(workId);
    // 썸네일 업로드 (실패해도 무시)
    try {
      setPatchingImage(true);
      const url = await captureAndUploadScreenshot(workId);
      if (url) {
        await apiFetch(`/api/works/${workId}/preview-url`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ previewUrl: url }),
        });
      }
    } catch (e) {
      console.warn("[customizer] 초기 썸네일 업로드 실패 (무시)", e);
    } finally {
      setPatchingImage(false);
    }
    return workId;
  }, [
    savedWorkId,
    design,
    accessory,
    colors,
    flowerColors,
    autoSize,
    radius,
    sizeOption,
    size,
    apiFetch,
  ]);

  // 저장 (생성/수정 통합)
  const saveWork = useCallback(async () => {
    try {
      setSaving(true);
      if (!savedWorkId) {
        await ensureWorkCreated();
        console.log("[customizer] 기본 정보(신규) 저장 완료");
        return;
      }
      // 수정
      const id = savedWorkId;
      const patchBody = buildWorkPayload(
        design,
        accessory,
        colors,
        flowerColors,
        autoSize,
        radius,
        sizeOption,
        size
      );
      const patchRes = await apiFetch(`/api/works/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) {
        const t = await patchRes.text();
        throw new Error(t || `편집 PATCH 실패 ${patchRes.status}`);
      }
      console.log("[customizer] 변경 사항 저장 완료");
      // 썸네일 자동 업데이트
      try {
        setPatchingImage(true);
        const newUrl = await captureAndUploadScreenshot(id);
        if (newUrl) {
          const resPreview = await apiFetch(`/api/works/${id}/preview-url`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ previewUrl: newUrl }),
          });
          if (!resPreview.ok) {
            const t2 = await resPreview.text();
            throw new Error(
              t2 || `미리보기 URL 갱신 실패 ${resPreview.status}`
            );
          }
          console.log("[customizer] 썸네일 자동 업데이트 완료");
        }
      } catch (thumbErr) {
        console.error("[customizer] 썸네일 자동 업데이트 실패", thumbErr);
      } finally {
        setPatchingImage(false);
      }
    } finally {
      setSaving(false);
      setPatchingImage(false);
    }
  }, [
    savedWorkId,
    ensureWorkCreated,
    design,
    accessory,
    colors,
    flowerColors,
    autoSize,
    radius,
    sizeOption,
    size,
    apiFetch,
  ]);

  // 장바구니 추가
  const addToCart = useCallback(async () => {
    if (saving) return;
    try {
      const workId = await ensureWorkCreated();
      const optionHash = buildCartOptionHash({
        accessory,
        design,
        colors,
        flowerColors,
        size,
        sizeOption,
        count,
        radius,
        flowers: flowersOptions[0] || null,
      });
      const unitPrice = getAccessoryTotalPrice(
        accessory,
        Number(size) || 0,
        design
      );
      const payload: CartPayload = {
        workId,
        name: generateWorkName(design, accessory),
        thumbUrl: imageUploadedUrl || null,
        unitPrice,
        quantity: 1,
        optionHash,
      };
      const cartRes = await apiFetch(`/api/cart/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!cartRes.ok) {
        const txt = await cartRes.text();
        throw new Error(txt || `장바구니 담기 실패 (${cartRes.status})`);
      }
      alert("장바구니에 담았습니다.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "장바구니 담기 실패";
      alert(msg);
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    ensureWorkCreated,
    accessory,
    design,
    colors,
    flowerColors,
    size,
    sizeOption,
    count,
    radius,
    flowersOptions,
    imageUploadedUrl,
    apiFetch,
  ]);

  return (
    <div className={styles.pageLayout}>
      {/* 미리보기 */}
      <div className={`${styles.canvasArea}`} ref={canvasWrapperRef}>
        <ViewerSwitch
          design={design}
          colors={colors}
          count={count}
          flowers={flowersOptions[0] || 6}
          ringRadius={radius}
          petalColor={flowerColors.petal}
          centerColor={flowerColors.center}
          cameraDistance={cameraDistance}
        />
      </div>

      {/* 설정 패널 */}
      <SettingsPanel
        isLocal={isLocal}
        design={design}
        setDesign={setDesign}
        accessory={accessory}
        setAccessory={setAccessory}
        colors={colors}
        onColorChange={handleColorChange}
        onAddColor={addColor}
        onRemoveColor={removeColor}
        size={size}
        sizeOption={sizeOption}
        countOption={countOption}
        radiusOption={radiusOption}
        setSize={setSize}
        setCount={setCount}
        setRadius={setRadius}
        flowerColors={flowerColors}
        setFlowerColors={setFlowerColors}
        saving={saving}
        patchingImage={patchingImage}
        loadingExisting={loadingExisting}
        isEditMode={isEditMode}
        onSave={saveWork}
        onOrder={() => {
          if (saving) return;
          alert("주문 기능은 준비중입니다.");
        }}
        onAddToCart={addToCart}
        deleting={deleting}
        onDelete={async () => {
          if (!savedWorkId || deleting) return;
          if (
            !confirm("정말 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")
          )
            return;
          try {
            setDeleteError(null);
            setDeleting(true);
            const res = await apiFetch(`/api/works`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([savedWorkId]),
            });
            if (!res.ok) {
              const txt = await res.text();
              throw new Error(txt || `삭제 실패 (${res.status})`);
            }
            window.location.href = "/myworks";
          } catch (pe: unknown) {
            const msg = pe instanceof Error ? pe.message : "삭제 실패";
            setDeleteError(msg);
          } finally {
            setDeleting(false);
          }
        }}
        deleteError={deleteError}
        imageUploading={imageUploading}
        savedWorkId={savedWorkId}
        onReuploadThumb={async () => {
          if (!savedWorkId) return;
          const url = await captureAndUploadScreenshot(savedWorkId);
          if (url) {
            try {
              setPatchingImage(true);
              const patchRes = await apiFetch(
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
        onOpenUploaded={() =>
          imageUploadedUrl && window.open(imageUploadedUrl, "_blank")
        }
        imageUploadedUrl={imageUploadedUrl}
      />
    </div>
  );
}

export default function CustomizerPage() {
  return (
    <Suspense
      fallback={<div className={styles.loadingFallback}>로딩중...</div>}
    >
      <CustomizerContent />
    </Suspense>
  );
}
