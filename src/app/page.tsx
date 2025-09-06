import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <div className={styles.sparkleBg}>
        <div className={styles.sparkle} style={{ top: '20%', left: '15%' }} />
        <div className={styles.sparkle} style={{ top: '40%', left: '60%' }} />
        <div className={styles.sparkle} style={{ top: '70%', left: '30%' }} />
        <div className={styles.sparkle} style={{ top: '80%', left: '80%' }} />
        <div className={styles.sparkle} style={{ top: '55%', left: '45%' }} />
        <div className={styles.sparkle} style={{ top: '10%', left: '75%' }} />
      </div>
      <div className={styles.page}>
        <div className={styles.centerText}>
          <span className={styles.pink}>마이디</span>에서 만드는<br />나만의 커스텀 악세사리
        </div>
        <div className={styles.cards}>
          <div className={styles.card}>카드 1</div>
          <div className={styles.card}>카드 2</div>
          <div className={styles.card}>카드 3</div>
          <div className={styles.card}>카드 4</div>
          <div className={styles.card}>카드 5</div>
          <div className={styles.card}>카드 6</div>
        </div>
      </div>
    </>
  );
}
