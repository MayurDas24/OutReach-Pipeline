import React from 'react';
import styles from './StageCard.module.css';

const STAGE_COLORS = {
  ocean:     'var(--stage-ocean)',
  prospeo:   'var(--stage-prospeo)',
  eazyreach: 'var(--stage-eazyreach)',
  brevo:     'var(--stage-brevo)'
};

const STAGE_ICONS = {
  ocean:     '◈',
  prospeo:   '◉',
  eazyreach: '◎',
  brevo:     '◆'
};

const STATUS_LABELS = {
  idle: 'Waiting',
  running: 'Running',
  complete: 'Complete',
  error: 'Failed',
  pending: 'Waiting'
};

export default function StageCard({ stageKey, stage, index }) {
  const color = STAGE_COLORS[stageKey];
  const icon = STAGE_ICONS[stageKey];
  const isRunning = stage.status === 'running';
  const isComplete = stage.status === 'complete';
  const isError = stage.status === 'error';
  const isIdle = stage.status === 'idle' || stage.status === 'pending';

  const latestMessage = stage.messages?.[stage.messages.length - 1] ?? '';

  return (
    <div
      className={`${styles.card} ${styles[stage.status]}`}
      style={{ '--stage-color': color }}
    >
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <span className={styles.icon}>{icon}</span>
          {isRunning && <span className={styles.pulse} />}
        </div>
        <div className={styles.info}>
          <div className={styles.num} style={{ color }}>0{index + 1}</div>
          <div className={styles.name}>{stage.label}</div>
          <div className={styles.subtitle}>{stage.subtitle}</div>
        </div>
        <div className={styles.statusBadge}>
          {isRunning ? (
            <span className={styles.spinner} />
          ) : (
            <span className={`${styles.dot} ${styles[`dot_${stage.status}`]}`} />
          )}
          <span className={styles.statusText}>{STATUS_LABELS[stage.status] ?? stage.status}</span>
        </div>
      </div>

      {isComplete && (
        <div className={styles.count}>
          <span className={styles.countNum}>{stage.count}</span>
          <span className={styles.countLabel}>{stage.subtitle.toLowerCase()}</span>
        </div>
      )}

      {isRunning && latestMessage && (
        <div className={styles.progressLine}>
          <span className={styles.cursor}>›</span>
          <span className={styles.progressText}>{latestMessage}</span>
        </div>
      )}

      {isError && (
        <div className={styles.errorLine}>
          <span>✗ Stage failed</span>
        </div>
      )}

      {/* Message log — last few entries */}
      {stage.messages?.length > 0 && (isRunning || isComplete) && (
        <div className={styles.log}>
          {stage.messages.slice(-5).map((msg, i) => (
            <div key={i} className={styles.logLine}>
              <span className={styles.logCursor}>·</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
