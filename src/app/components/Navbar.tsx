// 네비게이션바
import styles from './Navbar.module.css';
import Link from "next/link";
import { MapoFlowerIsland, RidiBatang } from '../fonts';

function Navbar() {
    return (
        <nav className={`${styles.navbar}`}>
            <div className={styles['navbar-left']}>
                <div
                    className={styles['navbar-brand']}
                >
                    <div className={`${styles['navbar-title']} ${MapoFlowerIsland.className}`}>Mydea</div>
                </div>
            </div>
            <ul className={styles['navbar-menu']}>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/samples/bids">Bids</Link></li>
                <li><Link href="/monthly">Monthly</Link></li>
                <li><Link href="/my">My</Link></li>
            </ul>
        </nav>
    );
}

export default Navbar;