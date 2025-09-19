"use client";
import { PretendardRegular, PretendardExtraBold } from "@/app/fonts";
import styles from "../customizer.module.css";

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
  selectedIdx: number;
  setSelectedIdx: (i: number) => void;
  setSize: (s: string) => void;
  setCount: (n: number) => void;
  setRadius: (n: number) => void;
  flowerColors: { petal: string; center: string };
  setFlowerColors: (c: { petal: string; center: string }) => void;
  flowersOptions: number[];
  saving: boolean;
  patchingImage: boolean;
  loadingExisting: boolean;
  isEditMode: boolean;
  onSave: () => Promise<void>;
  onOrder: () => void;
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
    selectedIdx,
    setSelectedIdx,
    setSize,
    setCount,
    setRadius,
    flowerColors,
    setFlowerColors,
    flowersOptions,
    saving,
    patchingImage,
    loadingExisting,
    isEditMode,
    onSave,
    onOrder,
    deleting,
    onDelete,
    deleteError,
    imageUploading,
    savedWorkId,
    onReuploadThumb,
    onOpenUploaded,
    imageUploadedUrl,
  } = p;

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
