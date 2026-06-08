/**
 * Stage 1 — Ocean.io  (v2 API)
 * POST https://api.ocean.io/v2/search/companies?apiToken=<key>
 * Body: { size, companiesFilters: { lookalikeDomains: [domain] } }
 * Response: { companies: [{ domain, name, description, employeeCountOcean, ... }] }
 */

const { createHttpClient } = require('../utils/httpClient');
const { deduplicateDomains } = require('../utils/domainUtils');
const emitter = require('../utils/pipelineEmitter');
const config = require('../config/env');
const logger = require('../config/logger');

const STAGE = 'ocean';
const BASE_URL = 'https://api.ocean.io';

function getClient() {
  // Ocean.io uses apiToken as a query param — we pass a no-auth client
  // and append the token per-request
  return createHttpClient({
    baseURL: BASE_URL,
    apiKey: '',        // token goes in query string, not header
    authHeader: 'x-noop',
    authPrefix: '',
    stageName: STAGE
  });
}

async function findLookalikeCompanies(seedDomain) {
  const client = getClient();

  emitter.stageStart(STAGE, 'Finding lookalike companies');
  logger.info(`Ocean.io: lookalike search for ${seedDomain}`, { stage: STAGE });

  try {
    emitter.stageProgress(STAGE, `Querying Ocean.io for companies similar to ${seedDomain}…`);

    /**
     * Ocean.io v2 Company Search
     * POST /v2/search/companies?apiToken=<key>
     * Docs: https://app.ocean.io/docs → searchCompaniesV3
     */
    const response = await client.post(
      `/v2/search/companies?apiToken=${config.OCEAN_API_KEY}`,
      {
        size: config.OCEAN_MAX_RESULTS,
        companiesFilters: {
          lookalikeDomains: [seedDomain],
          minScore: 0.75
        }
      }
    );

    const raw = response.data?.companies ?? response.data?.results ?? [];

    if (!Array.isArray(raw) || raw.length === 0) {
      emitter.stageError(STAGE, 'Ocean.io returned no lookalike companies');
      return [];
    }

    const rawDomains = raw.map(c => c.domain).filter(Boolean);
    const domains = deduplicateDomains(rawDomains, seedDomain);

    const enriched = domains.map(domain => {
      const c = raw.find(x => x.domain === domain) || {};
      return {
        domain,
        name: c.name || domain,
        description: c.description || '',
        industry: c.industry || c.mainIndustry || '',
        employeeCount: c.employeeCountOcean || c.employeeCount || null,
        country: c.primaryCountry || ''
      };
    });

    logger.info(`Ocean.io: found ${enriched.length} companies`, { stage: STAGE });
    emitter.stageProgress(STAGE, `Found ${enriched.length} lookalike companies`, enriched);
    emitter.stageComplete(STAGE, enriched.length, enriched);
    return enriched;

  } catch (err) {
    const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? err.message;
    logger.error(`Ocean.io failed: ${msg}`, { stage: STAGE });
    emitter.stageError(STAGE, `Ocean.io failed: ${msg}`);
    throw err;
  }
}

module.exports = { findLookalikeCompanies };
