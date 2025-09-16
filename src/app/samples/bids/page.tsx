"use client";
import styles from "./page.module.css";
import TorusBeadViewer from "../_components/TorusBeadViewer";
import BeadFlowerViewer from "../_components/FlowerViewer";

export default function Playground() {
  // 컨트롤 패널 제거 (count/color 미사용)

  return (
    <div className={styles.bidsContainer}>
      <BeadFlowerViewer />
      <TorusBeadViewer />
    </div>
  );
}
