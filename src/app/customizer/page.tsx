'use client';
import BeadsViewer from './_components/BeadsViewer';
import { useState } from 'react';
import styles from './customizer.module.css';

export default function CustomizerPage() {
    // 색상 배열 상태 (최소 1개, 최대 7개)
    const [colors, setColors] = useState(["#ff8aa8"]);
    const [size, setSize] = useState('small');
    const [shape, setShape] = useState('round');
    const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
    const [design, setDesign] = useState<'basic' | 'flower'>('basic');
    const [flowerColors, setFlowerColors] = useState({ petal: '#ffb6c1', center: '#ffe066' });
    const [flowerPosition, setFlowerPosition] = useState<'center' | 'repeat'>('center');

    const handleColorChange = (idx: number, value: string) => {
        const newColors = [...colors];
        newColors[idx] = value;
        setColors(newColors);
    };
    const addColor = () => {
        if (colors.length < 7) setColors([...colors, "#ffffff"]);
    };
    const removeColor = (idx: number) => {
        if (colors.length > 1) setColors(colors.filter((_, i) => i !== idx));
    };

    return (
        <div style={{ display: 'flex', gap: 32, padding: 32 }}>
            {/* 왼쪽: BeadsViewer */}
            <div className={styles.canvasArea} style={{ flex: 1, minWidth: 300 }}>
                <BeadsViewer />
            </div>

            {/* 오른쪽: 설정 박스 */}
            <div className={styles.settingsBox}>
                <h2>설정값 커스터마이징</h2>

                {/* 디자인 선택 (기본, 꽃) */}
                <div className={styles.designRadioGroup}>
                  <button
                    type="button"
                    className={design === 'basic' ? `${styles.designRadioBtn} ${styles.selected}` : styles.designRadioBtn}
                    onClick={() => setDesign('basic')}
                  >기본</button>
                  <button
                    type="button"
                    className={design === 'flower' ? `${styles.designRadioBtn} ${styles.selected}` : styles.designRadioBtn}
                    onClick={() => setDesign('flower')}
                  >꽃</button>
                </div>

                {/* 꽃 디자인 추가 옵션 */}
                {design === 'flower' && (
                  <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontWeight: 500 }}>꽃잎 색상</label>
                      <input
                        type="color"
                        value={flowerColors.petal}
                        onChange={e => setFlowerColors({ ...flowerColors, petal: e.target.value })}
                        style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontWeight: 500 }}>중앙 색상</label>
                      <input
                        type="color"
                        value={flowerColors.center}
                        onChange={e => setFlowerColors({ ...flowerColors, center: e.target.value })}
                        style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontWeight: 500 }}>꽃 위치</label>
                      <label style={{ marginRight: 12 }}>
                        <input
                          type="radio"
                          name="flowerPosition"
                          value="center"
                          checked={flowerPosition === 'center'}
                          onChange={() => setFlowerPosition('center')}
                        /> 중앙
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="flowerPosition"
                          value="repeat"
                          checked={flowerPosition === 'repeat'}
                          onChange={() => setFlowerPosition('repeat')}
                        /> 반복
                      </label>
                    </div>
                  </div>
                )}

                {/* 색상 선택 (최소 1개, 최대 7개) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    색상 선택
                    <span style={{ position: 'relative', display: 'inline-block' }}>
                      <span
                        className={styles.infoIcon}
                        onMouseEnter={() => setTooltipIdx(0)}
                        onMouseLeave={() => setTooltipIdx(null)}
                      >i</span>
                      <span
                        className={styles.infoTooltip}
                        style={{ display: tooltipIdx === 0 ? 'block' : 'none' }}
                      >최소 1개, 최대 7개까지 색상을 추가할 수 있습니다.</span>
                    </span>
                  </label>
                  {colors.map((color, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={color}
                        onChange={e => handleColorChange(idx, e.target.value)}
                        style={{ width: 40, height: 40, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                      <button type="button" onClick={() => addColor()} disabled={colors.length >= 7} style={{ fontSize: 18, padding: '0 8px', borderRadius: 4, border: 'none', background: '#eee', cursor: colors.length < 7 ? 'pointer' : 'not-allowed' }}>+</button>
                      <button type="button" onClick={() => removeColor(idx)} disabled={colors.length <= 1} style={{ fontSize: 18, padding: '0 8px', borderRadius: 4, border: 'none', background: '#eee', cursor: colors.length > 1 ? 'pointer' : 'not-allowed' }}>-</button>
                    </div>
                  ))}
                </div>

                {/* 사이즈 선택 */}
                <div style={{ marginBottom: 18 }}>
                  <label className={styles.sizeLabel}>
                    사이즈
                    <span style={{ position: 'relative', display: 'inline-block' }}>
                      <span
                        className={styles.infoIcon}
                        onMouseEnter={() => setTooltipIdx(1)}
                        onMouseLeave={() => setTooltipIdx(null)}
                      >i</span>
                      <span
                        className={styles.infoTooltip}
                        style={{ display: tooltipIdx === 1 ? 'block' : 'none' }}
                      >
                        사이즈는 선택한 색상 개수에 따라 자동 계산되며, 수작업 특성에 따라 약간의 오차가 발생할 수 있습니다.<br />
                        (반지의 경우 ±0.3cm, 목걸이·팔찌의 경우 ±1cm)
                      </span>
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label>
                        <input
                            type="radio"
                            name="size"
                            value="small"
                            checked={size === 'small'}
                            onChange={() => setSize('small')}
                        />
                        Small
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="size"
                            value="medium"
                            checked={size === 'medium'}
                            onChange={() => setSize('medium')}
                        />
                        Medium
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="size"
                            value="large"
                            checked={size === 'large'}
                            onChange={() => setSize('large')}
                        />
                        Large
                    </label>
                  </div>
                </div>

                {/* 모양 드롭다운 */}
                <label>
                    모양 선택
                    <select value={shape} onChange={e => setShape(e.target.value)}>
                        <option value="round">둥근</option>
                        <option value="square">네모</option>
                        <option value="star">별</option>
                    </select>
                </label>

                <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
                    <button type="button" style={{ flex: 1, padding: '12px 0', borderRadius: 8, background: '#eee', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        저장하기
                    </button>
                    <button type="button" style={{ flex: 1, padding: '12px 0', borderRadius: 8, background: '#ff8aa8', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                        주문하기
                    </button>
                </div>
            </div>
        </div>
    );
}