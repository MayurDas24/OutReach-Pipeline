require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  OCEAN_API_KEY: z.string().min(1, 'OCEAN_API_KEY is required'),
  PROSPEO_API_KEY: z.string().min(1, 'PROSPEO_API_KEY is required'),
  EAZYREACH_API_KEY: z.string().min(1, 'EAZYREACH_API_KEY is required'),
  BREVO_API_KEY: z.string().min(1, 'BREVO_API_KEY is required'),

  BREVO_SENDER_EMAIL: z.string().email().default('hello@mayurdev.site'),
  BREVO_SENDER_NAME: z.string().default('Mayur | Dev Partnerships'),

  OCEAN_MAX_RESULTS: z.string().transform(Number).default('10'),
  PROSPEO_MAX_CONTACTS_PER_DOMAIN: z.string().transform(Number).default('3'),
  EAZYREACH_CONCURRENCY: z.string().transform(Number).default('2'),
  EAZYREACH_DELAY_MS: z.string().transform(Number).default('1200'),
  DRY_RUN: z.string().transform(v => v === 'true').default('false'),
});

let config;

try {
  config = envSchema.parse(process.env);
} catch (err) {
  console.error('❌  Environment validation failed:');
  err.errors.forEach(e => console.error(`   • ${e.path.join('.')}: ${e.message}`));
  process.exit(1);
}

module.exports = config;
