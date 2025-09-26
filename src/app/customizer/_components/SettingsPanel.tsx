"use client";
import { PretendardRegular, PretendardExtraBold } from "@/app/fonts";
import styles from "../customizer.module.css";
import {
  getAccessoryTotalPrice,
  ACCESSORY_SURCHARGE_THRESHOLDS,
  SURCHARGE_PER_MM,
} from "@/lib/customizerMath";

type Accessory = "ring" | "bracelet" | "necklace";

type Props = {
  isLocal: boolean;
  design: "basic" | "flower";
  setDesign: (d: "basic" | "flower") => void;
  accessory: Accessory;
  setAccessory: (a: Accessory) => void;
  colors: string[];
  onColorChange: (idx: number, value: string) => void;
  onAddColor: () => void;
  onRemoveColor: (idx: number) => void;
  size: string;
  sizeOption: number[];
  countOption: number[];
  radiusOption: number[];
  // removed unused selectedIdx
  // setSelectedIdx: (i: number) => void; // removed
  setSize: (s: string) => void;
  setCount: (n: number) => void;
  setRadius: (n: number) => void;
  flowerColors: { petal: string; center: string };
  setFlowerColors: (c: { petal: string; center: string }) => void;
  // flowersOptions removed (unused)
  saving: boolean;
  patchingImage: boolean;
  loadingExisting: boolean;
  isEditMode: boolean;
  onSave: () => Promise<void>;
  onOrder: () => void;
  onAddToCart?: () => void;
  deleting: boolean;
  onDelete?: () => Promise<void>;
  deleteError?: string | null;
  imageUploading: boolean;
  savedWorkId: number | null;
  onReuploadThumb?: () => Promise<void>;
  onOpenUploaded?: () => void;
  imageUploadedUrl?: string | null;
};

export default function SettingsPanel(p: Props) {
  const {
    isLocal,
    design,
    setDesign,
    accessory,
    setAccessory,
    colors,
    onColorChange,
    onAddColor,
    onRemoveColor,
    size,
    sizeOption,
    countOption,
    radiusOption,
    setSize,
    setCount,
    setRadius,
    flowerColors,
    setFlowerColors,
    saving,
    patchingImage,
    loadingExisting,
    isEditMode,
    onSave,
    onOrder,
    onAddToCart,
    deleting,
    onDelete,
    deleteError,
    imageUploading,
    savedWorkId,
    onReuploadThumb,
    onOpenUploaded,
    imageUploadedUrl,
  } = p;

  const sizeMm = Number(size) || 0;
  const threshold = ACCESSORY_SURCHARGE_THRESHOLDS[accessory] ?? 0;
  const excessMm = Math.max(0, sizeMm - threshold);
  const surcharge = excessMm * SURCHARGE_PER_MM;
  const totalPrice = getAccessoryTotalPrice(accessory, sizeMm, design);

  return (
    <div className={`${styles.settingsBox} ${PretendardRegular.className}`}>
      {/* 악세사리 */}
      <div className={styles.rowAccessory}>
        <label
          className={`${PretendardExtraBold.variable} ${styles.labelStrong}`}
        >
          악세사리
        </label>
        <div className={styles.radioGroupInline}>
          {(
            [
              ["ring", "반지"],
              ["bracelet", "팔찌"],
              ["necklace", "목걸이"],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="accessory"
                value={value}
                checked={accessory === value}
                onChange={() => setAccessory(value)}
              />{" "}
              {label}
            </label>
          ))}
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
        </label>

        {colors.map((color, idx) => (
          <div key={idx} className={styles.colorRow}>
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(idx, e.target.value)}
              className={styles.colorInput}
            />
            <button
              type="button"
              onClick={onAddColor}
              disabled={colors.length >= 7}
              className={styles.colorBtn}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onRemoveColor(idx)}
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
          <span className={styles.tooltipWrapper} tabIndex={0}>
            <span
              className={styles.infoIcon}
              aria-label="사이즈 옵션 안내"
              role="img"
            >
              i
            </span>
            <span className={styles.infoTooltip}>
              선택한 색상 개수({colors.length}개)에 따라 가능한 옵션이 자동
              계산됩니다.
              <br />
              색상을 추가/제거하면 사이즈 옵션이 업데이트돼요.
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
              // selectedIdx removed
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

      {/* 가격 표기 (사이즈 아래로 이동) */}
      <div className={styles.priceRow}>
        <span
          className={`${PretendardExtraBold.variable} ${styles.labelStrong}`}
        >
          가격{" "}
          <span className={styles.tooltipWrapper} tabIndex={0}>
            <span
              className={styles.infoIcon}
              aria-label="가격 책정 기준"
              role="img"
            >
              i
            </span>
            <span className={styles.infoTooltip}>
              기본 가격을 기준으로, 사이즈에 따른 추가요금이 발생합니다.
              <br />
              <br />
              악세사리 종류별 기본 가격
              <br />• 반지 (기본) 3,000원 / (꽃) 5,000원
              <br />• 팔찌 (기본) 5,000원 / (꽃) 8,000원
              <br />• 목걸이 (기본) 10,000원 / (꽃) 15,000원
              <br />
              <br />
              추가요금: 기준 초과분 1mm 당 100원
              <br />• 반지 {ACCESSORY_SURCHARGE_THRESHOLDS.ring}mm • 팔찌{" "}
              {ACCESSORY_SURCHARGE_THRESHOLDS.bracelet}mm • 목걸이{" "}
              {ACCESSORY_SURCHARGE_THRESHOLDS.necklace}mm
              {excessMm > 0 && (
                <>
                  <br />
                  <br />
                  현재 길이 {sizeMm}mm, 추가요금 {surcharge.toLocaleString()}원
                </>
              )}
            </span>
          </span>
        </span>
        <span className={styles.priceValue}>
          {totalPrice.toLocaleString()}원
        </span>
      </div>

      {/* 액션 버튼 */}
      <div className={styles.actionButtons}>
        <button
          type="button"
          className={styles.btnSave}
          disabled={saving || patchingImage || loadingExisting}
          onClick={onSave}
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
          className={styles.btnCart}
          disabled={saving || patchingImage || loadingExisting || deleting}
          onClick={onAddToCart}
        >
          장바구니
        </button>
        <button
          type="button"
          className={styles.btnOrder}
          disabled={saving}
          onClick={onOrder}
        >
          주문하기
        </button>
        {isEditMode && (
          <button
            type="button"
            className={styles.btnDelete}
            disabled={saving || deleting}
            onClick={onDelete}
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
            disabled={imageUploading || saving || patchingImage || !savedWorkId}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
            onClick={onReuploadThumb}
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
            onClick={onOpenUploaded}
          >
            업로드 이미지 열기
          </button>
        </div>
      )}
    </div>
  );
}
