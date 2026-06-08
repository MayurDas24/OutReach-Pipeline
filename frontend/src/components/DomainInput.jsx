import React, { useState } from 'react';
import styles from './DomainInput.module.css';

export default function DomainInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const validate = (v) => {
    if (!v.trim()) return 'Enter a seed domain';
    if (!/^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/.test(v.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])) {
      return 'Invalid domain — try stripe.com or notion.so';
    }
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate(value);
    if (err) { setError(err); return; }
    setError('');
    onSubmit(value.trim());
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>ONE INPUT. THEN HANDS OFF.</div>
        <h1 className={styles.title}>Automated Cold Outreach Pipeline</h1>
        <p className={styles.sub}>
          Enter a seed domain. The system finds lookalike companies, surfaces decision-makers,
          resolves verified emails, and sends personalized outreach — zero manual steps.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <span className={styles.prompt}>$</span>
            <input
              className={`${styles.input} mono`}
              type="text"
              placeholder="stripe.com"
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              disabled={disabled}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.btn}
              disabled={disabled || !value.trim()}
            >
              {disabled ? (
                <span className={styles.spinner} aria-label="Running" />
              ) : (
                <>RUN PIPELINE <span className={styles.arrow}>→</span></>
              )}
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>

        <div className={styles.pipeline}>
          {[
            { num: '01', name: 'Ocean.io', desc: 'Lookalike companies', color: 'var(--stage-ocean)' },
            { num: '02', name: 'Prospeo', desc: 'Decision-makers', color: 'var(--stage-prospeo)' },
            { num: '03', name: 'Eazyreach', desc: 'Verified emails', color: 'var(--stage-eazyreach)' },
            { num: '04', name: 'Brevo', desc: 'Outreach send', color: 'var(--stage-brevo)' }
          ].map((s, i, arr) => (
            <React.Fragment key={s.num}>
              <div className={styles.stageChip}>
                <span className={styles.stageNum} style={{ color: s.color }}>{s.num}</span>
                <span className={styles.stageName}>{s.name}</span>
                <span className={styles.stageDesc}>{s.desc}</span>
              </div>
              {i < arr.length - 1 && <span className={styles.arrow2}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
