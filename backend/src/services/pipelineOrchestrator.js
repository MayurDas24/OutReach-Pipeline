/**
 * Pipeline Orchestrator
 * Wires all four stages together and manages state,
 * error handling, and the safety checkpoint.
 */

const { normalizeDomain } = require('../utils/domainUtils');
const { findLookalikeCompanies } = require('../stages/stage1_ocean');
const { findDecisionMakers } = require('../stages/stage2_prospeo');
const { resolveEmails } = require('../stages/stage3_eazyreach');
const { sendOutreachEmails } = require('../stages/stage4_brevo');
const emitter = require('../utils/pipelineEmitter');
const logger = require('../config/logger');

/**
 * Pipeline state machine.
 * Holds the result of each stage so partial results
 * can be returned even if a later stage fails.
 */
function createPipelineState(seedDomain) {
  return {
    seedDomain,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'running', // 'running' | 'awaiting_checkpoint' | 'complete' | 'error'
    stages: {
      ocean:     { status: 'pending', data: null, count: 0 },
      prospeo:   { status: 'pending', data: null, count: 0 },
      eazyreach: { status: 'pending', data: null, count: 0 },
      brevo:     { status: 'pending', data: null, count: 0 }
    },
    error: null
  };
}

/**
 * The in-memory run registry.
 * Maps runId → { state, checkpointResolve }
 */
const runs = new Map();

/**
 * Generates a short unique run ID.
 */
function generateRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Starts the pipeline for a given domain.
 * Returns runId immediately; execution is async.
 *
 * @param {string} rawDomain - The seed domain input
 * @param {boolean} autoConfirm - Skip the safety checkpoint (CLI use)
 * @returns {string} runId
 */
function startPipeline(rawDomain, autoConfirm = false) {
  const seedDomain = normalizeDomain(rawDomain);
  const runId = generateRunId();
  const state = createPipelineState(seedDomain);

  runs.set(runId, { state, checkpointResolve: null });

  // Execute async, don't await
  executePipeline(runId, seedDomain, autoConfirm).catch(err => {
    logger.error(`Unhandled pipeline error for run ${runId}: ${err.message}`);
    const run = runs.get(runId);
    if (run) {
      run.state.status = 'error';
      run.state.error = err.message;
    }
    emitter.pipelineError(err.message);
  });

  return runId;
}

/**
 * The core async execution. Runs all four stages sequentially.
 */
async function executePipeline(runId, seedDomain, autoConfirm) {
  const run = runs.get(runId);
  const { state } = run;

  logger.info(`Pipeline started: ${runId} | seed: ${seedDomain}`, { runId });

  try {
    // ── Stage 1: Ocean.io ────────────────────────────────
    state.stages.ocean.status = 'running';
    const companies = await findLookalikeCompanies(seedDomain);
    state.stages.ocean.status = 'complete';
    state.stages.ocean.data = companies;
    state.stages.ocean.count = companies.length;

    if (companies.length === 0) {
      throw new Error('Stage 1: Ocean.io returned no lookalike companies. Try a different seed domain.');
    }

    // ── Stage 2: Prospeo ─────────────────────────────────
    state.stages.prospeo.status = 'running';
    const prospects = await findDecisionMakers(companies);
    state.stages.prospeo.status = 'complete';
    state.stages.prospeo.data = prospects;
    state.stages.prospeo.count = prospects.length;

    if (prospects.length === 0) {
      throw new Error('Stage 2: Prospeo found no decision-makers. The companies may be too small or the API returned no contacts.');
    }

    // ── Stage 3: Eazyreach ───────────────────────────────
    state.stages.eazyreach.status = 'running';
    const resolvedProspects = await resolveEmails(prospects);
    state.stages.eazyreach.status = 'complete';
    state.stages.eazyreach.data = resolvedProspects;
    state.stages.eazyreach.count = resolvedProspects.filter(p => p.email).length;

    const emailableCount = resolvedProspects.filter(p => p.email).length;
    if (emailableCount === 0) {
      throw new Error('Stage 3: No verified emails resolved. Cannot proceed to send.');
    }

    // ── Safety Checkpoint ────────────────────────────────
    state.status = 'awaiting_checkpoint';
    emitter.checkpoint(resolvedProspects.filter(p => p.email));

    if (!autoConfirm) {
      logger.info(`Checkpoint: waiting for user confirmation before sending ${emailableCount} emails`, { runId });

      // Wait for frontend to call /confirm or /cancel
      await new Promise((resolve, reject) => {
        run.checkpointResolve = { resolve, reject };
      });
    }

    state.status = 'running';

    // ── Stage 4: Brevo ───────────────────────────────────
    state.stages.brevo.status = 'running';
    const sendResults = await sendOutreachEmails(resolvedProspects);
    state.stages.brevo.status = 'complete';
    state.stages.brevo.data = sendResults;
    state.stages.brevo.count = sendResults.sent.length;

    // ── Complete ─────────────────────────────────────────
    state.status = 'complete';
    state.completedAt = new Date().toISOString();

    const summary = {
      runId,
      seedDomain,
      completedAt: state.completedAt,
      companies: companies.length,
      prospects: prospects.length,
      emailsResolved: emailableCount,
      emailsSent: sendResults.sent.length,
      emailsFailed: sendResults.failed.length,
      emailsSkipped: sendResults.skipped.length
    };

    logger.info(`Pipeline complete: ${JSON.stringify(summary)}`, { runId });
    emitter.pipelineComplete(summary);

  } catch (err) {
    state.status = 'error';
    state.error = err.message;

    // Mark current stage as failed
    for (const [stageName, stageState] of Object.entries(state.stages)) {
      if (stageState.status === 'running') {
        stageState.status = 'error';
      }
    }

    logger.error(`Pipeline failed: ${err.message}`, { runId });
    emitter.pipelineError(err.message);
    throw err;
  }
}

/**
 * Confirms the checkpoint — pipeline proceeds to send emails.
 */
function confirmCheckpoint(runId) {
  const run = runs.get(runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  if (run.state.status !== 'awaiting_checkpoint') throw new Error('Pipeline is not at checkpoint');
  if (!run.checkpointResolve) throw new Error('Checkpoint resolver not set');

  run.checkpointResolve.resolve();
  run.checkpointResolve = null;
  logger.info(`Checkpoint confirmed for run ${runId}`);
}

/**
 * Cancels at the checkpoint — aborts the pipeline before sending.
 */
function cancelCheckpoint(runId) {
  const run = runs.get(runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  if (run.state.status !== 'awaiting_checkpoint') throw new Error('Pipeline is not at checkpoint');
  if (!run.checkpointResolve) throw new Error('Checkpoint resolver not set');

  run.state.status = 'cancelled';
  run.checkpointResolve.reject(new Error('Pipeline cancelled by user at checkpoint'));
  run.checkpointResolve = null;
  logger.info(`Pipeline cancelled at checkpoint for run ${runId}`);
}

/**
 * Returns current run state.
 */
function getRunState(runId) {
  const run = runs.get(runId);
  if (!run) return null;
  return run.state;
}

module.exports = { startPipeline, confirmCheckpoint, cancelCheckpoint, getRunState, runs };
