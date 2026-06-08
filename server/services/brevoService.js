import axios from "axios";

function getBrevo() {
  return axios.create({
    baseURL: "https://api.brevo.com/v3",
    timeout: 30000,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
  });
}

function buildEmailContent(contact) {
  const firstName =
    contact.firstName || contact.fullName?.split(" ")[0] || "there";
  const company = contact.companyName || contact.companyDomain || "your company";

  const subject = `Quick idea for ${company}`;

  const htmlContent = `
<html>
  <body style="font-family: Arial, sans-serif; color: #1a1a2e; line-height: 1.7; max-width: 600px;">
    <p>Hi ${firstName},</p>
    <p>I came across <strong>${company}</strong> and wanted to reach out directly.</p>
    <p>I built an automated outreach pipeline that does in seconds what most teams spend hours on:</p>
    <ul>
      <li>Discovers similar companies from a single seed domain</li>
      <li>Finds C-suite and VP decision-makers with verified work emails</li>
      <li>Sends personalized outreach automatically after a human review step</li>
    </ul>
    <p>The whole thing runs on Ocean.io → Prospeo → Brevo, wired end-to-end. One input, zero manual handoffs.</p>
    <p>Would it be worth a quick 10-minute call this week?</p>
    <p>
      Best,<br/>
      <strong>Mayur Das</strong><br/>
      <a href="https://github.com/MayurDas24">github.com/MayurDas24</a>
    </p>
  </body>
</html>`.trim();

  const textContent =
    `Hi ${firstName},\n\n` +
    `I came across ${company} and wanted to reach out directly.\n\n` +
    `I built an automated outreach pipeline that discovers similar companies, finds decision-makers with verified emails, and sends personalized outreach after a human review step.\n\n` +
    `Would it be worth a quick 10-minute call this week?\n\nBest,\nMayur Das\ngithub.com/MayurDas24`;

  return { subject, htmlContent, textContent };
}

export async function sendOutreachEmail(contact) {
  if (!contact.email) {
    throw new Error(`contact.email is missing for ${contact.fullName}`);
  }

  if (process.env.BREVO_DRY_RUN === "true") {
    console.log(`[Brevo] DRY RUN — would send to ${contact.email}`);
    return { dryRun: true, to: contact.email };
  }

  if (!process.env.BREVO_API_KEY) {
    throw new Error("Missing BREVO_API_KEY in server/.env");
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error(
      "Missing BREVO_SENDER_EMAIL in server/.env — add the verified sender email from your Brevo dashboard"
    );
  }

  const { subject, htmlContent, textContent } = buildEmailContent(contact);

  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || "Mayur Das",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: contact.email, name: contact.fullName || contact.email }],
    subject,
    htmlContent,
    textContent,
  };

  const brevo = getBrevo();
  const { data } = await brevo.post("/smtp/email", payload);
  console.log(`[Brevo] ✓ Sent to ${contact.email} — messageId: ${data.messageId}`);
  return data;
}

export async function sendOutreachBatch(contacts) {
  const results = [];

  for (const contact of contacts) {
    try {
      const result = await sendOutreachEmail(contact);
      results.push({ success: true, contact, result });
    } catch (error) {
      const reason = error.response?.data?.message || error.message;
      console.error(`[Brevo] Failed for ${contact.email}: ${reason}`);
      results.push({ success: false, contact, error: reason });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`[Brevo] Batch complete: ${sent} sent, ${failed} failed`);
  return results;
}