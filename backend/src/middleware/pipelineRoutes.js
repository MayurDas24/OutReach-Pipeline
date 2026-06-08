const { Router } = require('express');
const { z } = require('zod');
const { startPipeline, confirmCheckpoint, cancelCheckpoint, getRunState } = require('../services/pipelineOrchestrator');
const emitter = require('../utils/pipelineEmitter');
const logger = require('../config/logger');

const router = Router();

// ── POST /api/pipeline/start ──────────────────────────────────────────────────
// Kicks off a new pipeline run. Returns a runId immediately.
// The client should then open an SSE connection to /api/pipeline/:runId/stream.
router.post('/start', (req, res) => {
  const schema = z.object({
    domain: z.string().min(3, 'Domain is required').max(253)
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error.errors[0].message
    });
  }

  try {
    const runId = startPipeline(result.data.domain);
    logger.info(`Pipeline started via API: ${runId} for domain: ${result.data.domain}`);
    return res.json({ success: true, runId });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ── GET /api/pipeline/:runId/stream ──────────────────────────────────────────
// Server-Sent Events stream for real-time pipeline progress.
router.get('/:runId/stream', (req, res) => {
  const { runId } = req.params;

  // Verify the run exists
  const state = getRunState(runId);
  if (!state) {
    return res.status(404).json({ success: false, error: 'Run not found' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering
  res.flushHeaders();

  // Send a heartbeat every 20s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 20000);

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify({ type: 'state', state: getRunState(runId) })}\n\n`);

  // Forward pipeline events to this SSE client
  const onEvent = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  emitter.on('event', onEvent);

  req.on('close', () => {
    clearInterval(heartbeat);
    emitter.removeListener('event', onEvent);
    logger.debug(`SSE client disconnected for run ${runId}`);
  });
});

// ── GET /api/pipeline/:runId/state ───────────────────────────────────────────
// Polling endpoint — returns the current run state snapshot.
router.get('/:runId/state', (req, res) => {
  const state = getRunState(req.params.runId);
  if (!state) return res.status(404).json({ success: false, error: 'Run not found' });
  return res.json({ success: true, state });
});

// ── POST /api/pipeline/:runId/confirm ────────────────────────────────────────
// Confirms the safety checkpoint — pipeline proceeds to send emails.
router.post('/:runId/confirm', (req, res) => {
  try {
    confirmCheckpoint(req.params.runId);
    return res.json({ success: true, message: 'Checkpoint confirmed. Sending emails…' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ── POST /api/pipeline/:runId/cancel ─────────────────────────────────────────
// Cancels at the checkpoint — aborts before sending.
router.post('/:runId/cancel', (req, res) => {
  try {
    cancelCheckpoint(req.params.runId);
    return res.json({ success: true, message: 'Pipeline cancelled. No emails were sent.' });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
