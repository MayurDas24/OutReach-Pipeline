import React from 'react';
import Header from './components/Header.jsx';
import DomainInput from './components/DomainInput.jsx';
import StageCard from './components/StageCard.jsx';
import CheckpointModal from './components/CheckpointModal.jsx';
import SummaryView from './components/SummaryView.jsx';
import LogTerminal from './components/LogTerminal.jsx';
import { usePipeline } from './hooks/usePipeline.js';
import styles from './App.module.css';

const STAGE_ORDER = ['ocean', 'prospeo', 'eazyreach', 'brevo'];

export default function App() {
  const {
    status, stages, checkpointContacts, summary, error, logs,
    run, confirm, cancel, reset
  } = usePipeline();

  const isRunning = status === 'running';
  const isCheckpoint = status === 'checkpoint';
  const isComplete = status === 'complete';
  const isCancelled = status === 'cancelled';
  const isError = status === 'error';
  const showInput = status === 'idle' || isError || isCancelled;
  const showStages = !showInput || isRunning;

  return (
    <div className={styles.app}>
      <Header />

      <main className={styles.main}>
        {/* Domain Input */}
        {(status === 'idle' || isError || isCancelled) && (
          <div className={styles.section}>
            {(isError || isCancelled) && (
              <div className={`${styles.banner} ${isError ? styles.bannerError : styles.bannerCancelled}`}>
                <span>{isError ? '✗' : '○'}</span>
                <span>{isError ? `Pipeline failed: ${error}` : 'Pipeline cancelled. No emails were sent.'}</span>
                <button className={styles.bannerClose} onClick={reset}>↺ Start over</button>
              </div>
            )}
            <DomainInput onSubmit={run} disabled={isRunning} />
          </div>
        )}

        {/* Running / Stages View */}
        {(isRunning || isCheckpoint || isComplete || isCancelled) && !showInput && (
          <>
            <div className={styles.section}>
              <div className={styles.statusBar}>
                <div className={styles.runStatus}>
                  <span className={`${styles.runDot} ${styles[`runDot_${status}`]}`} />
                  <span className={styles.runLabel}>
                    {isRunning && 'Pipeline running…'}
                    {isCheckpoint && 'Awaiting checkpoint confirmation'}
                    {isComplete && 'Pipeline complete'}
                    {isCancelled && 'Pipeline cancelled'}
                  </span>
                </div>
                {(isComplete || isCancelled) && (
                  <button className={styles.newRunBtn} onClick={reset}>↺ New run</button>
                )}
              </div>
            </div>

            {/* Stages grid */}
            {!isComplete && (
              <div className={styles.section}>
                <div className={styles.stagesGrid}>
                  {STAGE_ORDER.map((key, i) => (
                    <React.Fragment key={key}>
                      <StageCard stageKey={key} stage={stages[key]} index={i} />
                      {i < STAGE_ORDER.length - 1 && (
                        <div className={styles.connector}>
                          <div className={`${styles.connectorLine} ${
                            stages[STAGE_ORDER[i]].status === 'complete' ? styles.connectorActive : ''
                          }`} />
                          <span className={styles.connectorArrow}>▸</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Log terminal */}
            {!isComplete && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Live Log</div>
                <LogTerminal logs={logs} />
              </div>
            )}
          </>
        )}

        {/* Summary */}
        {isComplete && (
          <SummaryView summary={summary} stages={stages} onReset={reset} />
        )}
      </main>

      {/* Safety Checkpoint Modal */}
      {isCheckpoint && (
        <CheckpointModal
          contacts={checkpointContacts}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
