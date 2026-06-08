/**
 * Stage 3 — Eazyreach
 *
 * Eazyreach is primarily a Chrome extension + Indian B2B tool.
 * Their public REST API (if issued) uses:
 *   POST /api/v1/enrich  or  POST /api/v1/linkedin-email
 *   Body: { linkedin_url: string }  OR  { url: string }
 *   Auth: Authorization: Bearer <key>  OR  X-API-KEY: <key>
 *
 * Since Prospeo already resolves emails in Stage 2 (bulk-enrich-person),
 * this stage acts as a FALLBACK enrichment pass for any prospect
 * that still has no email after Stage 2.
 *
 * If Eazyreach's API shape differs from what you see here, update
 * EAZYREACH_ENDPOINT and the request body in resolveOne() below.
 * The rest of the resilience/retry/rate-limit logic is solid.
 */

const pLimit = require('p-limit').default;
const { createHttpClient, sleep } = require('../utils/httpClient');
const emitter = require('../utils/pipelineEmitter');
const config = require('../config/env');
const logger = require('../config/logger');

const STAGE = 'eazyreach';
const BASE_URL = 'https://api.eazyreach.app';

// ← Update this if the Eazyreach team tells you a different path
const EAZYREACH_ENDPOINT = '/api/v1/linkedin-email';

function getClient() {
  return createHttpClient({
    baseURL: BASE_URL,
    apiKey: config.EAZYREACH_API_KEY,
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    stageName: STAGE,
    timeout: 25000
  });
}

async function resolveOne(client, prospect) {
  if (!prospect.linkedinUrl) {
    return { ...prospect, skipReason: 'no_linkedin_url' };
  }

  try {
    /**
     * Eazyreach LinkedIn Email Finder
     * POST /api/v1/linkedin-email
     * Headers: Authorization: Bearer <key>
     * Body: { linkedin_url: "https://linkedin.com/in/..." }
     * Response: { email: string, verified: boolean, status: string }
     *           OR { data: { email: ... } }
     */
    const response = await client.post(EAZYREACH_ENDPOINT, {
      linkedin_url: prospect.linkedinUrl
    });

    const d = response.data;
    const email = d?.email ?? d?.data?.email ?? null;
    const verified = d?.verified ?? d?.data?.verified ?? false;
    const status = d?.status ?? d?.data?.status ?? 'unknown';

    if (!email) {
      return { ...prospect, email: null, emailResolved: false, skipReason: 'no_email_found' };
    }

    return { ...prospect, email, emailVerified: verified, emailStatus: status, emailResolved: true };
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) return { ...prospect, email: null, emailResolved: false, skipReason: 'not_in_database' };
    if (status === 402) {
      emitter.stageError(STAGE, 'Eazyreach credits exhausted');
      return { ...prospect, email: null, emailResolved: false, skipReason: 'credits_exhausted' };
    }
    logger.warn(`Eazyreach: failed for ${prospect.fullName}: ${err.message}`, { stage: STAGE });
    return { ...prospect, email: null, emailResolved: false, skipReason: 'api_error' };
  }
}

/**
 * Main stage — enriches prospects that have no email from Stage 2.
 * Prospects that already have an email are passed through untouched.
 */
async function resolveEmails(prospects) {
  emitter.stageStart(STAGE, 'Resolving email addresses');
  logger.info(`Eazyreach: ${prospects.length} total prospects`, { stage: STAGE });

  // Split: already have email vs need resolution
  const alreadyResolved = prospects.filter(p => p.email);
  const needsResolution = prospects.filter(p => !p.email && p.linkedinUrl);
  const noLinkedIn = prospects.filter(p => !p.email && !p.linkedinUrl);

  logger.info(
    `Eazyreach: ${alreadyResolved.length} already have email, ${needsResolution.length} need resolution, ${noLinkedIn.length} have no LinkedIn`,
    { stage: STAGE }
  );

  if (alreadyResolved.length > 0) {
    emitter.stageProgress(STAGE, `Passing through ${alreadyResolved.length} already-resolved emails from Prospeo`);
  }

  if (needsResolution.length === 0) {
    const all = [...alreadyResolved, ...noLinkedIn.map(p => ({ ...p, skipReason: 'no_linkedin_url' }))];
    emitter.stageComplete(STAGE, alreadyResolved.length, all);
    return all;
  }

  const client = getClient();
  const limit = pLimit(config.EAZYREACH_CONCURRENCY);
  let processed = 0;

  const tasks = needsResolution.map(prospect =>
    limit(async () => {
      const result = await resolveOne(client, prospect);
      processed++;

      const tag = result.email ? `✓ ${result.email}` : `✗ (${result.skipReason})`;
      emitter.stageProgress(
        STAGE,
        `[${processed}/${needsResolution.length}] ${prospect.fullName} — ${tag}`
      );

      await sleep(config.EAZYREACH_DELAY_MS);
      return result;
    })
  );

  const freshlyResolved = await Promise.all(tasks);

  const allResults = [
    ...alreadyResolved,
    ...freshlyResolved,
    ...noLinkedIn.map(p => ({ ...p, skipReason: 'no_linkedin_url' }))
  ];

  const totalWithEmail = allResults.filter(p => p.email).length;
  logger.info(`Eazyreach: ${totalWithEmail} total with email`, { stage: STAGE });
  emitter.stageComplete(STAGE, totalWithEmail, allResults);
  return allResults;
}

module.exports = { resolveEmails };
