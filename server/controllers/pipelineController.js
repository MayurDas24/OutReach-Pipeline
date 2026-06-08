/*import { findLookalikeCompanies } from "../services/oceanService.js";
import { findDecisionMakers } from "../services/prospeoService.js";
import { sendOutreachBatch } from "../services/brevoService.js";

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

// Demo fallback — only used if Prospeo returns 0 contacts
// Sends to your own email so the pipeline can still be demonstrated
function makeDemoContacts(companies) {
  const execs = [
    { firstName: "Alex", lastName: "Johnson", title: "CEO" },
    { firstName: "Sarah", lastName: "Chen", title: "Head of Growth" },
    { firstName: "James", lastName: "Williams", title: "VP Sales" },
  ];
  return companies.slice(0, 3).map((company, i) => ({
    ...execs[i % execs.length],
    fullName: `${execs[i % execs.length].firstName} ${execs[i % execs.length].lastName}`,
    email: `mayurrdas05@gmail.com`, // your own email for demo purposes
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
  */
import { findLookalikeCompanies } from "../services/oceanService.js";
import { findDecisionMakers } from "../services/prospeoService.js";
import { sendOutreachBatch } from "../services/brevoService.js";

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

// Takes real people found by Prospeo (with real names/titles/LinkedIn)
// but routes emails to your own address since free plan can't reveal emails
function injectDemoEmails(realContacts, fallbackEmail) {
  return realContacts.map(contact => ({
    ...contact,
    email: fallbackEmail,
    emailVerified: true,
    source: "prospeo-demo", // real person, demo email routing
  }));
}

// Pure fallback — only if Prospeo found zero people at all
function makeGenericDemoContacts(companies, fallbackEmail) {
  const execs = [
    { firstName: "Alex", lastName: "Johnson", title: "CEO" },
    { firstName: "Sarah", lastName: "Chen", title: "Head of Growth" },
    { firstName: "James", lastName: "Williams", title: "VP Sales" },
  ];
  return companies.slice(0, 3).map((company, i) => ({
    ...execs[i % execs.length],
    fullName: `${execs[i % execs.length].firstName} ${execs[i % execs.length].lastName}`,
    email: fallbackEmail,
    emailVerified: true,
    companyName: company.name,
    companyDomain: company.domain,
    linkedinUrl: "",
    source: "demo-fallback",
  }));
}

export async function runPipeline(req, res) {
  try {
    const domain = normalizeDomain(req.body.domain || req.body.seedDomain);
    if (!domain) return res.status(400).json({ success: false, message: "domain is required" });

    console.log(`[INFO] Pipeline started for domain: ${domain}`);

    const companies = await findLookalikeCompanies(domain);
    console.log(`[INFO] Ocean stage complete: ${companies.length} companies`);

    // prospeoService now returns real people with real names/titles/LinkedIn
    // but email will be empty (free plan can't reveal)
    const realPeople = await findDecisionMakers(companies);
    console.log(`[INFO] Prospeo found ${realPeople.length} real people`);

    const DEMO_EMAIL = process.env.DEMO_FALLBACK_EMAIL || "mayurrdas05@gmail.com";

    let contacts;
    let usingDemoEmail = false;

    if (realPeople.length > 0) {
      // Real people found — use their data but route to demo email
      contacts = injectDemoEmails(realPeople.slice(0, 5), DEMO_EMAIL);
      usingDemoEmail = true;
      console.log(`[INFO] Using ${contacts.length} real Prospeo contacts with demo email routing`);
    } else {
      // No people found at all — generic fallback
      contacts = makeGenericDemoContacts(companies, DEMO_EMAIL);
      usingDemoEmail = true;
      console.log(`[INFO] Generic demo fallback: ${contacts.length} contacts`);
    }

    return res.json({
      success: true,
      seedDomain: domain,
      companies,
      contacts,
      usingDemoEmail,
      stages: {
        ocean: { status: companies.length ? "success" : "empty", count: companies.length },
        prospeo: { status: "success", count: contacts.length, note: "real people found; email reveal requires paid plan" },
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