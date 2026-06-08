#!/usr/bin/env node
/**
 * CLI Entry Point
 * Usage: node src/cli.js <seed-domain> [--dry-run] [--auto-confirm]
 *
 * Examples:
 *   node src/cli.js stripe.com
 *   node src/cli.js stripe.com --dry-run
 *   node src/cli.js stripe.com --auto-confirm
 */

require('dotenv').config();
const readline = require('readline');
const { normalizeDomain } = require('./utils/domainUtils');
const { findLookalikeCompanies } = require('./stages/stage1_ocean');
const { findDecisionMakers } = require('./stages/stage2_prospeo');
const { resolveEmails } = require('./stages/stage3_eazyreach');
const { sendOutreachEmails } = require('./stages/stage4_brevo');
const logger = require('./config/logger');

// Override DRY_RUN if flag is set
if (process.argv.includes('--dry-run')) {
  process.env.DRY_RUN = 'true';
}

const autoConfirm = process.argv.includes('--auto-confirm');
const rawDomain = process.argv[2];

if (!rawDomain) {
  console.error('\n  Usage: node src/cli.js <seed-domain> [--dry-run] [--auto-confirm]\n');
  process.exit(1);
}

function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

function printTable(data, columns) {
  const widths = columns.map(col => Math.max(col.label.length, ...data.map(r => String(r[col.key] ?? '').length)));
  const header = columns.map((c, i) => c.label.padEnd(widths[i])).join('  │  ');
  const sep = widths.map(w => '─'.repeat(w)).join('──┼──');
  console.log('\n  ' + header);
  console.log('  ' + sep);
  data.forEach(row => {
    console.log('  ' + columns.map((c, i) => String(row[c.key] ?? '').padEnd(widths[i])).join('  │  '));
  });
  console.log();
}

async function main() {
  console.log('\n  ╔══════════════════════════════════════════╗');
  console.log('  ║   OUTREACH PIPELINE — CLI Runner         ║');
  console.log('  ╚══════════════════════════════════════════╝\n');

  let seedDomain;
  try {
    seedDomain = normalizeDomain(rawDomain);
    console.log(`  Seed domain: ${seedDomain}\n`);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    process.exit(1);
  }

  try {
    // ── Stage 1 ──────────────────────────────────────────
    console.log('  [1/4] Ocean.io — Finding lookalike companies…');
    const companies = await findLookalikeCompanies(seedDomain);
    console.log(`  ✓ Found ${companies.length} companies\n`);
    printTable(companies.slice(0, 5), [
      { key: 'name', label: 'Company' },
      { key: 'domain', label: 'Domain' },
      { key: 'industry', label: 'Industry' }
    ]);

    if (companies.length === 0) {
      console.error('  ✗ No lookalike companies found. Try a different seed domain.');
      process.exit(1);
    }

    // ── Stage 2 ──────────────────────────────────────────
    console.log('  [2/4] Prospeo — Finding decision-makers…');
    const prospects = await findDecisionMakers(companies);
    console.log(`  ✓ Found ${prospects.length} decision-makers\n`);
    printTable(prospects.slice(0, 5), [
      { key: 'fullName', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'companyName', label: 'Company' }
    ]);

    if (prospects.length === 0) {
      console.error('  ✗ No decision-makers found.');
      process.exit(1);
    }

    // ── Stage 3 ──────────────────────────────────────────
    console.log('  [3/4] Eazyreach — Resolving verified emails…');
    const resolvedProspects = await resolveEmails(prospects);
    const withEmails = resolvedProspects.filter(p => p.email);
    console.log(`  ✓ Resolved ${withEmails.length}/${prospects.length} emails\n`);
    printTable(withEmails.slice(0, 5), [
      { key: 'fullName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'companyName', label: 'Company' }
    ]);

    if (withEmails.length === 0) {
      console.error('  ✗ No verified emails resolved.');
      process.exit(1);
    }

    // ── Safety Checkpoint ────────────────────────────────
    console.log('\n  ┌─────────────────────────────────────────────┐');
    console.log(`  │  CHECKPOINT — ${withEmails.length} emails ready to send         │`);
    console.log('  │  Review the list above before proceeding.   │');
    console.log('  └─────────────────────────────────────────────┘\n');

    if (!autoConfirm) {
      const answer = await prompt('  Proceed with sending? (yes/no): ');
      if (!['yes', 'y'].includes(answer.toLowerCase())) {
        console.log('\n  Pipeline cancelled. No emails were sent.\n');
        process.exit(0);
      }
    } else {
      console.log('  Auto-confirm enabled. Proceeding…\n');
    }

    // ── Stage 4 ──────────────────────────────────────────
    console.log('  [4/4] Brevo — Sending personalized outreach…');
    const { sent, failed, skipped } = await sendOutreachEmails(resolvedProspects);
    console.log(`  ✓ Sent: ${sent.length}  Failed: ${failed.length}  Skipped: ${skipped.length}\n`);

    // ── Summary ───────────────────────────────────────────
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   PIPELINE COMPLETE                      ║');
    console.log(`  ║   Companies:  ${String(companies.length).padEnd(4)} lookalikes found      ║`);
    console.log(`  ║   Prospects:  ${String(prospects.length).padEnd(4)} decision-makers      ║`);
    console.log(`  ║   Emails:     ${String(withEmails.length).padEnd(4)} resolved            ║`);
    console.log(`  ║   Sent:       ${String(sent.length).padEnd(4)} emails dispatched    ║`);
    console.log('  ╚══════════════════════════════════════════╝\n');

  } catch (err) {
    console.error(`\n  ✗ Pipeline failed: ${err.message}\n`);
    logger.error(err.message, { stack: err.stack });
    process.exit(1);
  }
}

main();
