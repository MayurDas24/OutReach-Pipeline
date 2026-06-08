import React from 'react';
import styles from './CheckpointModal.module.css';

export default function CheckpointModal({ contacts, onConfirm, onCancel }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.warningIcon}>⚠</span>
          <div>
            <div className={styles.eyebrow}>SAFETY CHECKPOINT</div>
            <h2 className={styles.title}>Review before sending</h2>
          </div>
        </div>

        <p className={styles.desc}>
          The pipeline has resolved <strong>{contacts.length}</strong> verified contacts.
          Review the list below, then confirm to send personalized outreach.
          This action cannot be undone.
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Company</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={i}>
                  <td>{c.fullName || `${c.firstName} ${c.lastName}`.trim() || '—'}</td>
                  <td className={styles.muted}>{c.title || '—'}</td>
                  <td>{c.companyName || c.domain || '—'}</td>
                  <td className={styles.email}>{c.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel — don't send
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            Send {contacts.length} emails →
          </button>
        </div>
      </div>
    </div>
  );
}
