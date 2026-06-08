import React, { useEffect, useRef } from 'react';
import styles from './LogTerminal.module.css';

const LEVEL_CLASSES = {
  info: styles.info,
  success: styles.success,
  warn: styles.warn,
  error: styles.error,
  http: styles.http,
  debug: styles.debug
};

export default function LogTerminal({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!logs.length) {
    return (
      <div className={styles.terminal}>
        <div className={styles.termBar}>
          <span className={styles.dot} style={{ background: '#ff5f57' }} />
          <span className={styles.dot} style={{ background: '#febc2e' }} />
          <span className={styles.dot} style={{ background: '#28c840' }} />
          <span className={styles.termTitle}>pipeline.log</span>
        </div>
        <div className={styles.empty}>
          <span className={styles.cursor}>_</span>
          <span className={styles.emptyText}>Waiting for pipeline start…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.terminal}>
      <div className={styles.termBar}>
        <span className={styles.dot} style={{ background: '#ff5f57' }} />
        <span className={styles.dot} style={{ background: '#febc2e' }} />
        <span className={styles.dot} style={{ background: '#28c840' }} />
        <span className={styles.termTitle}>pipeline.log</span>
        <span className={styles.count}>{logs.length} entries</span>
      </div>
      <div className={styles.body}>
        {logs.map((log, i) => (
          <div key={i} className={`${styles.line} ${LEVEL_CLASSES[log.level] ?? ''}`}>
            <span className={styles.ts}>
              {new Date(log.ts).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={styles.msg}>{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
