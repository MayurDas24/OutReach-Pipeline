import React from 'react';
import styles from './SummaryView.module.css';

export default function SummaryView({ summary, stages, onReset }) {
  const sentContacts = stages?.brevo?.data?.sent ?? [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.hero}>
        <div className={styles.checkmark}>✓</div>
        <div className={styles.eyebrow}>PIPELINE COMPLETE</div>
        <h2 className={styles.title}>Outreach dispatched</h2>
        <p className={styles.seedNote}>Seed: <span className={styles.mono}>{summary?.seedDomain}</span></p>
      </div>

      <div className={styles.stats}>
        {[
          { label: 'Companies found', value: summary?.companies ?? 0, note: 'via Ocean.io' },
          { label: 'Decision-makers', value: summary?.prospects ?? 0, note: 'via Prospeo' },
          { label: 'Emails resolved', value: summary?.emailsResolved ?? 0, note: 'via Eazyreach' },
          { label: 'Emails sent', value: summary?.emailsSent ?? 0, note: 'via Brevo', highlight: true },
        ].map(s => (
          <div key={s.label} className={`${styles.stat} ${s.highlight ? styles.highlight : ''}`}>
            <div className={styles.statNum}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statNote}>{s.note}</div>
          </div>
        ))}
      </div>

      {sentContacts.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Emails Sent</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sentContacts.map((c, i) => (
                  <tr key={i}>
                    <td>{c.fullName || '—'}</td>
                    <td className={styles.muted}>{c.companyName}</td>
                    <td className={styles.email}>{c.email}</td>
                    <td className={styles.muted}>{c.subject}</td>
                    <td>
                      <span className={`${styles.badge} ${c.dryRun ? styles.dry : styles.sent}`}>
                        {c.dryRun ? 'DRY RUN' : 'SENT'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.resetBtn} onClick={onReset}>
          ↺ Run another pipeline
        </button>
      </div>
    </div>
  );
}
