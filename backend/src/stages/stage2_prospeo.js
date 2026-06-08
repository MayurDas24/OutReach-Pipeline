/**
 * Stage 2 — Prospeo  (New 2025 API)
 *
 * Two-step process per company domain:
 *   Step A: POST /search-person  → get person_ids (no email returned)
 *           Filters: company.websites = [domain], seniority = C-Suite/VP/Director/Founder
 *   Step B: POST /bulk-enrich-person → get verified emails by person_id
 *
 * Auth: X-KEY header
 */

const pLimit = require('p-limit').default;
const { createHttpClient, sleep } = require('../utils/httpClient');
const emitter = require('../utils/pipelineEmitter');
const config = require('../config/env');
const logger = require('../config/logger');

const STAGE = 'prospeo';
const BASE_URL = 'https://api.prospeo.io';

// Prospeo enum values for seniority — from /api-docs/enum/seniorities
const TARGET_SENIORITIES = ['C-Suite', 'VP', 'Director', 'Founder/Owner'];

function getClient() {
  return createHttpClient({
    baseURL: BASE_URL,
    apiKey: config.PROSPEO_API_KEY,
    authHeader: 'X-KEY',
    authPrefix: '',
    stageName: STAGE
  });
}

/**
 * Step A: Search for decision-makers at a domain.
 * Returns array of { person_id, first_name, last_name, current_job_title, linkedin_url }
 */
async function searchPeopleAtDomain(client, domain) {
  /**
   * POST https://api.prospeo.io/search-person
   * Body: {
   *   page: 1,
   *   filters: {
   *     person_seniority: { include: [...] },
   *     company: { websites: [domain] }
   *   }
   * }
   * Response: { error: false, results: [{ person: {...}, company: {...} }] }
   */
  const response = await client.post('/search-person', {
    page: 1,
    filters: {
      person_seniority: { include: TARGET_SENIORITIES },
      company: { websites: [domain] }
    }
  });

  if (response.data?.error) {
    throw new Error(response.data?.error_code || 'Prospeo search-person error');
  }

  const results = response.data?.results ?? [];
  return results
    .slice(0, config.PROSPEO_MAX_CONTACTS_PER_DOMAIN)
    .map(r => ({
      person_id: r.person?.person_id,
      firstName: r.person?.first_name ?? '',
      lastName: r.person?.last_name ?? '',
      fullName: r.person?.full_name ?? `${r.person?.first_name ?? ''} ${r.person?.last_name ?? ''}`.trim(),
      title: r.person?.current_job_title ?? '',
      linkedinUrl: r.person?.linkedin_url ?? '',
      companyName: r.company?.name ?? domain,
      domain
    }))
    .filter(p => p.person_id); // must have person_id to enrich
}

/**
 * Step B: Bulk enrich persons to get verified emails.
 * Sends up to 50 person_ids at once.
 */
async function bulkEnrichPersons(client, persons) {
  if (persons.length === 0) return [];

  /**
   * POST https://api.prospeo.io/bulk-enrich-person
   * Body: {
   *   only_verified_email: true,
   *   data: [{ id: "1", data: { person_id: "..." } }, ...]
   * }
   * Response: {
   *   error: false,
   *   response: {
   *     valid_datapoints: [{ id, error, person: { email: { email, verification: { status } } } }],
   *     invalid_datapoints: [...]
   *   }
   * }
   */
  const payload = {
    only_verified_email: true,
    data: persons.map((p, i) => ({
      id: String(i + 1),
      data: { person_id: p.person_id }
    }))
  };

  const response = await client.post('/bulk-enrich-person', payload);

  if (response.data?.error) {
    throw new Error(response.data?.error_code || 'Prospeo bulk-enrich error');
  }

  const valid = response.data?.response?.valid_datapoints ?? [];

  // Map results back to our person objects
  return persons.map((person, i) => {
    const enriched = valid.find(v => v.id === String(i + 1));
    const email = enriched?.person?.email?.email ?? null;
    const status = enriched?.person?.email?.verification?.status ?? null;

    return {
      ...person,
      email: email,
      emailVerified: status === 'VALID',
      emailStatus: status,
      emailResolved: !!email,
      skipReason: email ? null : (enriched?.error_code || 'not_found')
    };
  });
}

/**
 * Main stage — processes all companies.
 */
async function findDecisionMakers(companies) {
  const client = getClient();

  emitter.stageStart(STAGE, 'Finding decision-makers');
  logger.info(`Prospeo: searching ${companies.length} companies`, { stage: STAGE });

  const limit = pLimit(2); // Keep concurrency low — 1 credit per page
  const allProspects = [];
  let processed = 0;

  const tasks = companies.map(company =>
    limit(async () => {
      try {
        // Step A: find people
        const persons = await searchPeopleAtDomain(client, company.domain);
        processed++;

        if (persons.length === 0) {
          emitter.stageProgress(STAGE, `[${processed}/${companies.length}] ${company.domain} — no contacts`);
          return;
        }

        // Step B: get their emails in bulk
        const enriched = await bulkEnrichPersons(client, persons);
        allProspects.push(...enriched);

        const withEmail = enriched.filter(p => p.email).length;
        emitter.stageProgress(
          STAGE,
          `[${processed}/${companies.length}] ${company.domain} → ${persons.length} contacts, ${withEmail} emails`,
          { domain: company.domain, count: persons.length }
        );

        await sleep(600);
      } catch (err) {
        processed++;
        const msg = err?.response?.data?.error_code ?? err.message;
        logger.warn(`Prospeo: failed for ${company.domain}: ${msg}`, { stage: STAGE });
        emitter.stageProgress(STAGE, `⚠ Skipped ${company.domain}: ${msg}`);
      }
    })
  );

  await Promise.all(tasks);

  // Deduplicate by LinkedIn URL
  const seen = new Set();
  const unique = allProspects.filter(p => {
    const key = p.linkedinUrl || `${p.fullName}@${p.domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logger.info(`Prospeo: ${unique.length} unique prospects`, { stage: STAGE });
  emitter.stageComplete(STAGE, unique.length, unique);
  return unique;
}

module.exports = { findDecisionMakers };
