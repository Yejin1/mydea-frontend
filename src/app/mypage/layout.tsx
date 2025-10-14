import type { ReactNode } from "react";
import Sidebar from "./_components/Sidebar";
import styles from "./mypage.module.css";

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        <Sidebar />
        <section className={styles.content}>{children}</section>
      </div>
    </div>
  );
}
