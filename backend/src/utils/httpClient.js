const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../config/logger');

/**
 * Creates a pre-configured axios instance for a given API.
 * Includes exponential backoff retry, 429 rate-limit handling,
 * and request/response interceptors for logging.
 */
function createHttpClient({ baseURL, apiKey, authHeader = 'Authorization', authPrefix = 'Bearer', timeout = 15000, stageName = 'http' }) {
  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      [authHeader]: `${authPrefix} ${apiKey}`.trim(),
    }
  });

  axiosRetry(client, {
    retries: 3,
    retryDelay: (retryCount, error) => {
      // Honour Retry-After header if present (429 responses)
      const retryAfter = error?.response?.headers?.['retry-after'];
      if (retryAfter) {
        const ms = parseInt(retryAfter, 10) * 1000;
        logger.warn(`Rate limited by ${stageName}. Retry-After: ${retryAfter}s`, { stage: stageName });
        return ms;
      }
      const delay = axiosRetry.exponentialDelay(retryCount);
      logger.debug(`Retry #${retryCount} for ${stageName}, delay ${delay}ms`, { stage: stageName });
      return delay;
    },
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
             error?.response?.status === 429 ||
             error?.response?.status === 503;
    },
    onRetry: (retryCount, error, requestConfig) => {
      logger.warn(`Retrying request to ${requestConfig.url} (attempt ${retryCount})`, {
        stage: stageName,
        status: error?.response?.status
      });
    }
  });

  // Request logger
  client.interceptors.request.use(config => {
    logger.debug(`→ ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, { stage: stageName });
    return config;
  });

  // Response logger
  client.interceptors.response.use(
    response => {
      logger.debug(`← ${response.status} ${response.config.url}`, { stage: stageName });
      return response;
    },
    error => {
      const status = error?.response?.status;
      const url = error?.config?.url;
      logger.error(`← ${status ?? 'NETWORK_ERROR'} ${url}`, {
        stage: stageName,
        message: error?.response?.data?.message ?? error.message
      });
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Sleep utility for manual rate limiting.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { createHttpClient, sleep };
