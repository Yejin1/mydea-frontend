"use client";
import { useControls } from "leva";
import styles from "./page.module.css";
import BeadViewer from "../_components/BeadViewer";

export default function Playground() {
  const { count, color } = useControls({
    count: { value: 60, min: 10, max: 200, step: 1 },
    color: { value: "#ff6699" },
  });

  return <div className={styles.bidsContainer}>
    <BeadViewer count={count} color={color} />
  </div>;
}
