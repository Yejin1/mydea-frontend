"use client";
import BeadsViewer from "./_components/BeadsViewer";
import { useEffect, useMemo, useState } from "react";
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
  const [shape, setShape] = useState("round");
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const [design, setDesign] = useState<"basic" | "flower">("basic");
  const [flowerColors, setFlowerColors] = useState({
    petal: "#ffb6c1",
    center: "#ffe066",
  });
  const [flowerPosition, setFlowerPosition] = useState<"center" | "repeat">(
    "center"
  );
  const [accessory, setAccessory] = useState<Accessory>("ring");
  const [autoSize, setAutoSize] = useState<number>(0);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // 옵션 계산 함수
  function computeOptions(acc: Accessory, colorCount: number) {
    let minCount = 24;
    let maxCount = 36;
    if (acc === "bracelet") {
      minCount = 90;
      maxCount = 126;
    }
    if (acc === "necklace") {
      minCount = 228;
      maxCount = 282;
    }

    // colorCount의 배수로 시작
    const start = Math.ceil(minCount / colorCount) * colorCount;
    const counts: number[] = [];
    for (let cnt = start; cnt <= maxCount; cnt += colorCount) counts.push(cnt);

    const radii = counts.map((c) => c / 5); // 예: radius = count / 5
    const sizes = counts.map((c) => Math.round((c * 5) / 3) / 10); // mm=>cm 표기(소수1자리)

    // autoSize는 첫 옵션 기준 (없으면 0)
    const auto = sizes[0] ?? 0;

    return { counts, radii, sizes, auto };
  }

  //accessory, colors.length 변화시에만 파생 옵션 재계산
  const derived = useMemo(
    () => computeOptions(accessory, colors.length),
    [accessory, colors.length]
  );

  // 파생값을 한 번에 교체
  useEffect(() => {
    setCountOption(derived.counts);
    setRadiusOption(derived.radii);
    setSizeOption(derived.sizes);
    setAutoSize(derived.auto);
  }, [derived]);

  useEffect(() => {
    // 자동 사이즈 옵션 계산
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
  }, [accessory, colors.length]);

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

  return (
    <div style={{ display: "flex", gap: 32, padding: 32 }}>
      {/* 왼쪽 BeadsViewer */}
      <div className={styles.canvasArea} style={{ flex: 1, minWidth: 300 }}>
        <BeadsViewer
          colors={colors}
          count={count}
          ringRadius={radius}
          cameraDistance={cameraDistance}
        />
      </div>

      {/* 오른쪽 설정 박스 */}
      <div className={`${styles.settingsBox} ${PretendardRegular.className}`}>
        {/* 악세사리 종류 선택 */}
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label
            className={PretendardExtraBold.variable}
            style={{ fontWeight: 800 }}
          >
            악세사리
          </label>
          <div>
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
            className={PretendardExtraBold.variable}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 800,
            }}
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
          <div
            style={{
              marginBottom: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label
                className={PretendardExtraBold.variable}
                style={{ fontWeight: 800 }}
              >
                꽃잎 색상
              </label>
              <input
                type="color"
                value={flowerColors.petal}
                onChange={(e) =>
                  setFlowerColors({ ...flowerColors, petal: e.target.value })
                }
                style={{
                  width: 32,
                  height: 32,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label
                className={PretendardExtraBold.variable}
                style={{ fontWeight: 800 }}
              >
                중앙 색상
              </label>
              <input
                type="color"
                value={flowerColors.center}
                onChange={(e) =>
                  setFlowerColors({ ...flowerColors, center: e.target.value })
                }
                style={{
                  width: 32,
                  height: 32,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label
                className={PretendardExtraBold.variable}
                style={{ fontWeight: 800 }}
              >
                꽃 위치
              </label>
              <label style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name="flowerPosition"
                  value="center"
                  checked={flowerPosition === "center"}
                  onChange={() => setFlowerPosition("center")}
                />{" "}
                중앙
              </label>
              <label>
                <input
                  type="radio"
                  name="flowerPosition"
                  value="repeat"
                  checked={flowerPosition === "repeat"}
                  onChange={() => setFlowerPosition("repeat")}
                />{" "}
                반복
              </label>
            </div>
          </div>
        )}

        {/* 색상 선택 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label
            className={PretendardExtraBold.variable}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 800,
            }}
          >
            색상 선택
            <span style={{ position: "relative", display: "inline-block" }}>
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
            <div
              key={idx}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(idx, e.target.value)}
                style={{
                  width: 40,
                  height: 40,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              />
              <button
                type="button"
                onClick={() => addColor()}
                disabled={colors.length >= 7}
                style={{
                  fontSize: 18,
                  padding: "0 8px",
                  borderRadius: 4,
                  border: "none",
                  background: "#eee",
                  cursor: colors.length < 7 ? "pointer" : "not-allowed",
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeColor(idx)}
                disabled={colors.length <= 1}
                style={{
                  fontSize: 18,
                  padding: "0 8px",
                  borderRadius: 4,
                  border: "none",
                  background: "#eee",
                  cursor: colors.length > 1 ? "pointer" : "not-allowed",
                }}
              >
                -
              </button>
            </div>
          ))}
        </div>

        {/* 사이즈 선택 + 자동 계산 표시 */}
        <div style={{ marginBottom: 18 }}>
          <label
            className={`${styles.sizeLabel} ${PretendardExtraBold.variable}`}
            style={{ fontWeight: 800 }}
          >
            사이즈
            <span style={{ position: "relative", display: "inline-block" }}>
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

          <div style={{ display: "flex", gap: 10 }}>
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
              style={{ padding: "8px", borderRadius: "6px", fontWeight: 500 }}
            >
              {sizeOption.map((opt, idx) => (
                <option key={idx} value={String(opt)}>
                  {opt}mm
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
          <button
            type="button"
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 8,
              background: "#eee",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            저장하기
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 8,
              background: "#ff8aa8",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            주문하기
          </button>
        </div>
      </div>
    </div>
  );
}
