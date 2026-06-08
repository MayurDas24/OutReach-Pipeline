const { z } = require('zod');

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (val) => /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/.test(val),
    { message: 'Invalid domain format. Expected: company.com' }
  );

/**
 * Validates and normalizes a seed domain.
 * Strips http/https/www prefix if accidentally included.
 */
function normalizeDomain(raw) {
  let domain = raw.trim().toLowerCase();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//, '');
  // Strip www.
  domain = domain.replace(/^www\./, '');
  // Strip trailing slash and path
  domain = domain.split('/')[0];

  const result = domainSchema.safeParse(domain);
  if (!result.success) {
    throw new Error(result.error.errors[0].message);
  }
  return result.data;
}

/**
 * Deduplicates an array of domains, removing empties and the seed domain itself.
 */
function deduplicateDomains(domains, seedDomain) {
  const seen = new Set();
  return domains.filter(d => {
    if (!d || typeof d !== 'string') return false;
    const normalized = d.trim().toLowerCase();
    if (!normalized || normalized === seedDomain) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

module.exports = { normalizeDomain, deduplicateDomains };
