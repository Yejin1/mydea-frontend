"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../mypage.module.css";

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  return (
    <aside className={styles.sidebar} aria-label="마이페이지 사이드바">
      <div className={styles.sideTitle}>마이페이지</div>
      <nav className={styles.sideMenu}>
        <Link
          href="/mypage/profile"
          className={`${styles.sideLink} ${
            isActive("/mypage/profile") ? styles.active : ""
          }`}
        >
          개인정보 수정
        </Link>
        <Link
          href="/mypage/addresses"
          className={`${styles.sideLink} ${
            isActive("/mypage/addresses") ? styles.active : ""
          }`}
        >
          배송지 관리
        </Link>
        <Link
          href="/orders"
          className={`${styles.sideLink} ${
            isActive("/orders") ? styles.active : ""
          }`}
        >
          주문 목록
        </Link>
      </nav>
    </aside>
  );
}
