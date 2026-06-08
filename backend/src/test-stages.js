#!/usr/bin/env node
/**
 * Stage-by-stage smoke test.
 * Run with real keys to verify each API integration before the demo.
 *
 * Usage:
 *   node src/test-stages.js --stage 1 --domain stripe.com
 *   node src/test-stages.js --stage 2 --domain stripe.com
 *   node src/test-stages.js --stage 3 --linkedin https://linkedin.com/in/patrickc
 *   node src/test-stages.js --stage 4 --email you@yourdomain.com --dry-run
 *   node src/test-stages.js --stage all --domain stripe.com --dry-run
 */
require('dotenv').config();

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);

const stage = get('--stage') || 'all';
const domain = get('--domain') || 'stripe.com';
const linkedin = get('--linkedin');
const testEmail = get('--email');

if (has('--dry-run')) process.env.DRY_RUN = 'true';

// Mock required env vars if not set (so env.js doesn't exit)
['OCEAN_API_KEY','PROSPEO_API_KEY','EAZYREACH_API_KEY','BREVO_API_KEY'].forEach(k => {
  if (!process.env[k]) process.env[k] = 'placeholder';
});

const { findLookalikeCompanies } = require('./stages/stage1_ocean');
const { findDecisionMakers }     = require('./stages/stage2_prospeo');
const { resolveEmails }          = require('./stages/stage3_eazyreach');
const { sendOutreachEmails }     = require('./stages/stage4_brevo');
const pipelineEmitter = require('./utils/pipelineEmitter');

// Print all events to stdout
pipelineEmitter.on('event', e => {
  const tag = `[${e.type}]`.padEnd(25);
  const msg = e.message || (e.count != null ? `count=${e.count}` : '') || JSON.stringify(e).slice(0,120);
  console.log(`  ${tag} ${msg}`);
});

async function run() {
  console.log(`\n  ═══ Stage Smoke Test ═══  stage=${stage}  domain=${domain}\n`);
  try {
    if (stage === '1' || stage === 'all') {
      console.log('\n  ── Stage 1: Ocean.io ──');
      const companies = await findLookalikeCompanies(domain);
      console.log(`  Result: ${companies.length} companies`);
      companies.slice(0,3).forEach(c => console.log(`    • ${c.name} (${c.domain})`));
      if (stage === '1') return;
    }

    if (stage === '2' || stage === 'all') {
      console.log('\n  ── Stage 2: Prospeo ──');
      const companies = stage === 'all'
        ? (await findLookalikeCompanies(domain)).slice(0, 2)
        : [{ domain, name: domain }];
      const prospects = await findDecisionMakers(companies);
      console.log(`  Result: ${prospects.length} prospects, ${prospects.filter(p=>p.email).length} with emails`);
      prospects.slice(0,3).forEach(p => console.log(`    • ${p.fullName} (${p.title}) — ${p.email || 'no email'}`));
      if (stage === '2') return;
    }

    if (stage === '3' && linkedin) {
      console.log('\n  ── Stage 3: Eazyreach ──');
      const mock = [{ fullName: 'Test Person', linkedinUrl: linkedin, email: null, domain }];
      const result = await resolveEmails(mock);
      console.log(`  Result:`, result[0]);
      return;
    }

    if (stage === '4' && testEmail) {
      console.log('\n  ── Stage 4: Brevo ──');
      const mock = [{
        email: testEmail, fullName: 'Test Person', firstName: 'Test',
        companyName: 'Test Co', domain, title: 'CEO'
      }];
      const result = await sendOutreachEmails(mock);
      console.log(`  Sent: ${result.sent.length}, Failed: ${result.failed.length}`);
      return;
    }

    console.log('\n  ✓ All stages complete (for --stage all, use --dry-run to skip email send)\n');
  } catch (err) {
    console.error(`\n  ✗ Error: ${err.message}\n`);
    process.exit(1);
  }
}

run();
