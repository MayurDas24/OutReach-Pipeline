/**
 * Stage 4 — Brevo  (Transactional Email)
 * POST https://api.brevo.com/v3/smtp/email
 * Auth: api-key header
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */

const pLimit = require('p-limit').default;
const { createHttpClient, sleep } = require('../utils/httpClient');
const { getSubjectLine, buildEmailHtml, buildEmailText } = require('../services/emailTemplates');
const emitter = require('../utils/pipelineEmitter');
const config = require('../config/env');
const logger = require('../config/logger');

const STAGE = 'brevo';
const BASE_URL = 'https://api.brevo.com/v3';

function getClient() {
  return createHttpClient({
    baseURL: BASE_URL,
    apiKey: config.BREVO_API_KEY,
    authHeader: 'api-key',
    authPrefix: '',
    stageName: STAGE
  });
}

async function sendOne(client, prospect) {
  const subject = getSubjectLine(prospect);
  const htmlContent = buildEmailHtml(prospect, config.BREVO_SENDER_NAME, config.BREVO_SENDER_EMAIL);
  const textContent = buildEmailText(prospect, config.BREVO_SENDER_NAME, config.BREVO_SENDER_EMAIL);

  /**
   * Brevo Send Transactional Email
   * POST /smtp/email
   * Required: sender{ name, email }, to[{ email, name }], subject, htmlContent
   * Response: { messageId: string }
   * Docs: https://developers.brevo.com/reference/sendtransacemail
   */
  const response = await client.post('/smtp/email', {
    sender: {
      name: config.BREVO_SENDER_NAME,
      email: config.BREVO_SENDER_EMAIL
    },
    to: [{
      email: prospect.email,
      name: prospect.fullName || prospect.firstName || 'Decision Maker'
    }],
    subject,
    htmlContent,
    textContent,
    tags: ['outreach-pipeline', prospect.domain],
    headers: {
      'X-Pipeline-Run': new Date().toISOString()
    }
  });

  return {
    messageId: response.data?.messageId,
    subject,
    sentTo: prospect.email
  };
}

async function sendOutreachEmails(prospects) {
  emitter.stageStart(STAGE, 'Sending personalized outreach emails');

  const emailable = prospects.filter(p => p.email);
  const skipped = prospects.filter(p => !p.email);

  logger.info(`Brevo: ${emailable.length} to send, ${skipped.length} skipped`, { stage: STAGE });

  if (emailable.length === 0) {
    emitter.stageError(STAGE, 'No contacts with verified emails — nothing to send');
    return { sent: [], failed: [], skipped };
  }

  if (config.DRY_RUN) {
    logger.info('DRY RUN — emails NOT sent', { stage: STAGE });
    emitter.stageProgress(STAGE, `[DRY RUN] Would send ${emailable.length} emails`);
    const dry = emailable.map(p => ({
      ...p,
      sendStatus: 'dry_run',
      subject: getSubjectLine(p),
      dryRun: true
    }));
    emitter.stageComplete(STAGE, emailable.length, { sent: dry, failed: [], skipped });
    return { sent: dry, failed: [], skipped };
  }

  const client = getClient();
  const limit = pLimit(2);
  const sent = [];
  const failed = [];
  let processed = 0;

  const tasks = emailable.map(prospect =>
    limit(async () => {
      try {
        const result = await sendOne(client, prospect);
        sent.push({ ...prospect, sendStatus: 'sent', messageId: result.messageId, subject: result.subject });
        processed++;
        logger.info(`Sent → ${prospect.email} (${prospect.fullName} @ ${prospect.companyName})`, { stage: STAGE });
        emitter.stageProgress(
          STAGE,
          `[${processed}/${emailable.length}] ✓ ${prospect.fullName} <${prospect.email}>`,
          { name: prospect.fullName, email: prospect.email, company: prospect.companyName }
        );
        await sleep(350);
      } catch (err) {
        const msg = err?.response?.data?.message ?? err.message;
        failed.push({ ...prospect, sendStatus: 'failed', error: msg });
        logger.warn(`Brevo: failed for ${prospect.email}: ${msg}`, { stage: STAGE });
        emitter.stageProgress(STAGE, `⚠ Failed: ${prospect.fullName} — ${msg}`);
      }
    })
  );

  await Promise.all(tasks);

  logger.info(`Brevo complete: sent=${sent.length} failed=${failed.length} skipped=${skipped.length}`, { stage: STAGE });
  emitter.stageComplete(STAGE, sent.length, { sent, failed, skipped });
  return { sent, failed, skipped };
}

module.exports = { sendOutreachEmails };
