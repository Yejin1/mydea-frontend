// 네비게이션바
import styles from "./Navbar.module.css";
import Link from "next/link";
import { MapoFlowerIsland, RidiBatang } from "../fonts";
import UserMenu from "./UserMenu";

function Navbar() {
  return (
    <nav className={`${styles.navbar}`}>
      <div className={styles["navbar-left"]}>
        <div className={styles["navbar-brand"]}>
          <div
            className={`${styles["navbar-title"]} ${MapoFlowerIsland.className}`}
          >
            <Link href="/">Mydea</Link>
          </div>
        </div>
      </div>
      <div className={styles["navbar-right"]}>
        <ul className={`${styles["navbar-menu"]} ${RidiBatang.className}`}>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/customizer">Make</Link>
          </li>
          <li>
            <Link href="/myworks" prefetch={false}>
              My
            </Link>
          </li>
        </ul>
        <Link href="/cart" prefetch={false}>
          <div className={styles.cartIconMask}></div>
        </Link>
        <UserMenu />
      </div>
    </nav>
  );
}

export default Navbar;
