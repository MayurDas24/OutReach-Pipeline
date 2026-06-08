import React from 'react';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>▸_</span>
          <span className={styles.name}>OUTREACH PIPELINE</span>
        </div>
        <div className={styles.meta}>
          <span className={styles.badge}>Vocallabs Assignment</span>
          <span className={styles.domain}>hello@mayurdev.site</span>
        </div>
      </div>
    </header>
  );
}
