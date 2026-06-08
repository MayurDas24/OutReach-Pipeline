import { findLookalikeCompanies } from "../services/oceanService.js";
import { findDecisionMakers } from "../services/prospeoService.js";
import { sendOutreachBatch } from "../services/brevoService.js";

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

// DEMO FALLBACK — used when Prospeo returns 0 (free plan limits)
// These are contacts we create from the real Ocean companies so the
// pipeline always reaches the checkpoint and Brevo send for the demo.
// REPLACE the email values with real emails you own for live testing.
function makeDemoContacts(companies) {
  const execs = [
    { firstName: "Alex", lastName: "Johnson", title: "CEO" },
    { firstName: "Sarah", lastName: "Chen", title: "Head of Growth" },
    { firstName: "James", lastName: "Williams", title: "VP Sales" },
  ];
  return companies.slice(0, 3).map((company, i) => ({
    ...execs[i % execs.length],
    fullName: `${execs[i % execs.length].firstName} ${execs[i % execs.length].lastName}`,
    // ⚠️ Replace with real emails you control for live Brevo send testing
    email: `mayurrdas05@gmail.com`,
    emailVerified: true,
    companyName: company.name,
    companyDomain: company.domain,
    source: "demo-fallback",
  }));
}

export async function runPipeline(req, res) {
  try {
    const domain = normalizeDomain(req.body.domain || req.body.seedDomain);
    if (!domain) return res.status(400).json({ success: false, message: "domain is required" });

    console.log(`[INFO] Pipeline started for domain: ${domain}`);

    console.log(`[INFO] Ocean stage started for ${domain}`);
    const companies = await findLookalikeCompanies(domain);
    console.log(`[INFO] Ocean stage complete: ${companies.length} companies`);

    console.log(`[INFO] Prospeo stage started for ${companies.length} companies`);
    let contacts = await findDecisionMakers(companies);
    console.log(`[INFO] Prospeo stage complete: ${contacts.length} verified contacts`);

    // Demo fallback: if Prospeo returns 0, inject contacts from Ocean companies
    // so the full pipeline (checkpoint → Brevo send) can still be demonstrated
    const usingFallback = contacts.length === 0 && companies.length > 0;
    if (usingFallback) {
      contacts = makeDemoContacts(companies);
      console.log(`[INFO] Demo fallback: injected ${contacts.length} contacts`);
    }

    return res.json({
      success: true,
      seedDomain: domain,
      companies,
      contacts,
      usingFallback,
      stages: {
        ocean: { status: companies.length ? "success" : "empty", count: companies.length },
        prospeo: { status: contacts.length ? "success" : "empty", count: contacts.length, usingFallback },
        checkpoint: { status: "waiting_for_approval", count: contacts.length },
        brevo: { status: "not_started", dryRun: process.env.BREVO_DRY_RUN === "true" },
      },
    });
  } catch (error) {
    console.error(`[SERVER ERROR]`, error);
    return res.status(500).json({ success: false, message: error.message || "Pipeline failed" });
  }
}

export async function sendApprovedEmails(req, res) {
  try {
    const contacts = Array.isArray(req.body.contacts) ? req.body.contacts : [];
    if (!contacts.length) return res.status(400).json({ success: false, message: "contacts array is required" });

    console.log(`[INFO] Brevo: sending to ${contacts.length} contacts`);
    const results = await sendOutreachBatch(contacts);

    return res.json({
      success: true,
      dryRun: process.env.BREVO_DRY_RUN === "true",
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error(`[SERVER ERROR]`, error);
    return res.status(500).json({ success: false, message: error.message || "Send failed" });
  }
}