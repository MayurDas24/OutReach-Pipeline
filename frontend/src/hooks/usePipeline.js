import { useState, useCallback, useRef } from 'react';
import { startPipeline, openPipelineStream, confirmCheckpoint, cancelCheckpoint } from '../utils/api';

const INITIAL_STAGES = {
  ocean:     { status: 'idle', label: 'Ocean.io', subtitle: 'Lookalike companies', data: [], count: 0, messages: [] },
  prospeo:   { status: 'idle', label: 'Prospeo',  subtitle: 'Decision-makers', data: [], count: 0, messages: [] },
  eazyreach: { status: 'idle', label: 'Eazyreach', subtitle: 'Verified emails', data: [], count: 0, messages: [] },
  brevo:     { status: 'idle', label: 'Brevo',    subtitle: 'Outreach emails', data: [], count: 0, messages: [] }
};

export function usePipeline() {
  const [runId, setRunId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | running | checkpoint | complete | error | cancelled
  const [stages, setStages] = useState(INITIAL_STAGES);
  const [checkpointContacts, setCheckpointContacts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const esRef = useRef(null);

  const addLog = useCallback((level, message) => {
    setLogs(prev => [...prev.slice(-199), { level, message, ts: Date.now() }]);
  }, []);

  const handleEvent = useCallback((event) => {
    const { type, stage, message, data, count, contacts, summary: s } = event;

    switch (type) {
      case 'state':
        // Initial state hydration on SSE connect
        if (event.state?.stages) {
          setStages(prev => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(event.state.stages)) {
              if (next[key]) next[key] = { ...next[key], status: val.status, count: val.count };
            }
            return next;
          });
        }
        break;

      case 'stage:start':
        setStages(prev => ({
          ...prev,
          [stage]: { ...prev[stage], status: 'running', messages: [] }
        }));
        addLog('info', `▶ ${INITIAL_STAGES[stage]?.label}: ${message || 'Starting…'}`);
        break;

      case 'stage:progress':
        setStages(prev => ({
          ...prev,
          [stage]: {
            ...prev[stage],
            messages: [...(prev[stage]?.messages ?? []).slice(-49), message]
          }
        }));
        break;

      case 'stage:complete':
        setStages(prev => ({
          ...prev,
          [stage]: {
            ...prev[stage],
            status: 'complete',
            count,
            data: data ?? prev[stage].data
          }
        }));
        addLog('success', `✓ ${INITIAL_STAGES[stage]?.label} complete — ${count} results`);
        break;

      case 'stage:error':
        setStages(prev => ({
          ...prev,
          [stage]: { ...prev[stage], status: 'error' }
        }));
        addLog('error', `✗ ${INITIAL_STAGES[stage]?.label}: ${message}`);
        break;

      case 'pipeline:checkpoint':
        setStatus('checkpoint');
        setCheckpointContacts(contacts ?? []);
        addLog('warn', `⚠ Checkpoint — ${contacts?.length ?? 0} emails ready. Review before sending.`);
        break;

      case 'pipeline:complete':
        setStatus('complete');
        setSummary(s);
        addLog('success', `✓ Pipeline complete — ${s?.emailsSent ?? 0} emails sent`);
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        break;

      case 'pipeline:error':
        setStatus('error');
        setError(message);
        addLog('error', `✗ Pipeline failed: ${message}`);
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        break;

      case 'log':
        addLog(event.level, message);
        break;

      default:
        break;
    }
  }, [addLog]);

  const run = useCallback(async (domain) => {
    // Reset
    setStatus('running');
    setStages(JSON.parse(JSON.stringify(INITIAL_STAGES)));
    setCheckpointContacts([]);
    setSummary(null);
    setError(null);
    setLogs([]);

    try {
      const id = await startPipeline(domain);
      setRunId(id);

      // Open SSE stream
      const es = openPipelineStream(id, handleEvent);
      esRef.current = es;
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }, [handleEvent]);

  const confirm = useCallback(async () => {
    if (!runId) return;
    try {
      await confirmCheckpoint(runId);
      setStatus('running');
      setStages(prev => ({
        ...prev,
        brevo: { ...prev.brevo, status: 'running' }
      }));
    } catch (err) {
      setError(err.message);
    }
  }, [runId]);

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      await cancelCheckpoint(runId);
      setStatus('cancelled');
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    } catch (err) {
      setError(err.message);
    }
  }, [runId]);

  const reset = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setRunId(null);
    setStatus('idle');
    setStages(JSON.parse(JSON.stringify(INITIAL_STAGES)));
    setCheckpointContacts([]);
    setSummary(null);
    setError(null);
    setLogs([]);
  }, []);

  return { runId, status, stages, checkpointContacts, summary, error, logs, run, confirm, cancel, reset };
}
