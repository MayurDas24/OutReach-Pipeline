const BASE = '/api/pipeline';

export async function startPipeline(domain) {
  const res = await fetch(`${BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.runId;
}

export async function confirmCheckpoint(runId) {
  const res = await fetch(`${BASE}/${runId}/confirm`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function cancelCheckpoint(runId) {
  const res = await fetch(`${BASE}/${runId}/cancel`, { method: 'POST' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export async function getPipelineState(runId) {
  const res = await fetch(`${BASE}/${runId}/state`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.state;
}

/**
 * Opens an SSE connection to the pipeline stream.
 * Returns an EventSource instance.
 * @param {string} runId
 * @param {(event: object) => void} onEvent
 * @returns {EventSource}
 */
export function openPipelineStream(runId, onEvent) {
  const es = new EventSource(`${BASE}/${runId}/stream`);
  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      onEvent(parsed);
    } catch {
      // ignore malformed
    }
  };
  es.onerror = () => {
    // SSE will auto-reconnect; that's fine
  };
  return es;
}
