/**
 * Email template engine.
 * Generates highly personalized cold outreach email copy
 * tailored to each prospect's role and company.
 */

/**
 * Returns the subject line for a given prospect.
 */
function getSubjectLine(prospect) {
  const { firstName, companyName, title } = prospect;
  const name = firstName || 'there';

  const subjects = [
    `${companyName} × a quick idea`,
    `Quick thought for you, ${name}`,
    `Noticed something about ${companyName}`,
    `A (genuinely short) note for ${name}`,
  ];

  // Rotate based on hash of company name for consistency
  const idx = companyName.charCodeAt(0) % subjects.length;
  return subjects[idx];
}

/**
 * Returns the opening line personalized by seniority/title.
 */
function getPersonalizedOpening(prospect) {
  const { firstName, title, companyName } = prospect;
  const name = firstName || 'there';
  const titleLower = (title || '').toLowerCase();

  if (/ceo|founder|president/.test(titleLower)) {
    return `As someone building the vision at ${companyName}, you probably hear a hundred pitches a week — I'll keep this short.`;
  }
  if (/cto|technical|engineering|architect/.test(titleLower)) {
    return `Engineers hate bloated outreach. So here's the actual thing:`;
  }
  if (/coo|operations|chief operating/.test(titleLower)) {
    return `COOs are allergic to inefficiency — so I'm not going to waste your time:`;
  }
  if (/vp|vice president|director/.test(titleLower)) {
    return `You've probably already solved the obvious problems at ${companyName}. This is about the less obvious one:`;
  }
  if (/marketing|growth|revenue/.test(titleLower)) {
    return `Growth folks get enough outreach. Here's why I'm reaching out to you specifically at ${companyName}:`;
  }

  return `I'll skip the usual opener and get to the point:`;
}

/**
 * Builds the full HTML email body for a prospect.
 */
function buildEmailHtml(prospect, senderName, senderEmail) {
  const { firstName, fullName, companyName, title, domain } = prospect;
  const name = firstName || fullName || 'there';
  const opening = getPersonalizedOpening(prospect);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; background: #f9f8f6; margin: 0; padding: 24px; color: #1a1a1a; }
    .wrapper { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e8e4de; border-radius: 4px; overflow: hidden; }
    .header { background: #0f0f0f; padding: 20px 28px; }
    .header-logo { color: #fff; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; font-family: 'Courier New', monospace; }
    .body { padding: 32px 28px; }
    p { line-height: 1.75; margin: 0 0 18px; font-size: 15px; }
    .highlight { background: #f0ede6; padding: 14px 18px; border-left: 3px solid #0f0f0f; margin: 24px 0; border-radius: 0 4px 4px 0; }
    .highlight p { margin: 0; font-size: 14px; }
    .cta { display: inline-block; margin-top: 8px; padding: 12px 24px; background: #0f0f0f; color: #fff !important; text-decoration: none; font-size: 13px; letter-spacing: 0.08em; border-radius: 3px; font-family: 'Courier New', monospace; }
    .footer { border-top: 1px solid #e8e4de; padding: 20px 28px; background: #f9f8f6; }
    .footer p { font-size: 12px; color: #888; margin: 0; line-height: 1.6; }
    a { color: #0f0f0f; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">mayurdev.site</div>
    </div>
    <div class="body">
      <p>Hi ${name},</p>
      <p>${opening}</p>
      <p>
        I've been following what ${companyName} is building, and I think there's a real opportunity
        to automate the parts of your outreach pipeline that are currently eating your team's time —
        without adding headcount.
      </p>
      <div class="highlight">
        <p>
          Most teams at the ${companyName} stage are manually sourcing leads, copy-pasting into spreadsheets,
          and sending templated blasts that get ignored. We've built end-to-end pipeline automation that takes
          a single seed input and handles sourcing → prospecting → email resolution → personalized send —
          entirely hands-off.
        </p>
      </div>
      <p>
        I'd love to show you a 12-minute live run on your actual domain. No deck. No pressure.
        Just the system working.
      </p>
      <p>Worth 15 minutes?</p>
      <a href="mailto:${senderEmail}?subject=Re: ${companyName} × outreach pipeline" class="cta">
        Reply to book time →
      </a>
      <p style="margin-top: 28px;">
        Best,<br>
        <strong>${senderName}</strong>
      </p>
    </div>
    <div class="footer">
      <p>
        You're receiving this because you're a decision-maker at ${companyName} (${domain}).<br>
        To opt out, reply with "unsubscribe" — I'll remove you immediately.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Builds plain-text fallback for email clients that don't render HTML.
 */
function buildEmailText(prospect, senderName, senderEmail) {
  const { firstName, fullName, companyName, title } = prospect;
  const name = firstName || fullName || 'there';
  const opening = getPersonalizedOpening(prospect);

  return `Hi ${name},

${opening}

I've been following what ${companyName} is building, and I think there's a real opportunity to automate the parts of your outreach pipeline that are currently eating your team's time — without adding headcount.

Most teams at the ${companyName} stage are manually sourcing leads, copy-pasting into spreadsheets, and sending templated blasts that get ignored. I've built end-to-end pipeline automation that takes a single seed input and handles sourcing → prospecting → email resolution → personalized send — entirely hands-off.

I'd love to show you a 12-minute live run on your actual domain. No deck. No pressure. Just the system working.

Worth 15 minutes? Just reply to this email.

Best,
${senderName}
${senderEmail}

---
To opt out, reply with "unsubscribe".`;
}

module.exports = { getSubjectLine, buildEmailHtml, buildEmailText };
