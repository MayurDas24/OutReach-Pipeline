/*import axios from "axios";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getProspeo() {
  return axios.create({
    baseURL: "https://api.prospeo.io",
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "X-KEY": process.env.PROSPEO_API_KEY,
    },
  });
}

async function searchPeopleAtDomain(prospeo, domain) {
  try {
    const { data } = await prospeo.post("/search-person", {
      page: 1,
      filters: {
        company: { websites: { include: [domain] } },
      },
    });

    if (data.error) {
      console.warn(`[Prospeo] search-person error for ${domain}: ${data.error_code}`);
      return [];
    }

    const results = data.results || [];
    console.log(`[Prospeo] ${domain}: ${results.length} people found`);
    // Results are shaped as { person: {...}, company: {...} }
    return results.slice(0, 2).map(r => r.person || r);
  } catch (err) {
    console.warn(`[Prospeo] search-person failed for ${domain}:`, err.response?.data?.error_code || err.message);
    return [];
  }
}

async function enrichPersonById(prospeo, personId, firstName, lastName, domain) {
  try {
    // Do NOT use only_verified_email:true — that prevents revelation on free plan
    const { data } = await prospeo.post("/enrich-person", {
      only_verified_email: false,
      enrich_mobile: false,
      data: { person_id: personId },
    });

    if (data.error) {
      console.warn(`[Prospeo] enrich failed for ${firstName} ${lastName}: ${data.error_code}`);
      return null;
    }

    const person = data.person;
    if (!person) return null;

    const emailObj = person.email || {};
    const email = emailObj.email || "";

    // Accept both VERIFIED revealed and any status as long as email is present
    if (!email) {
      console.log(`[Prospeo] No email at all for ${firstName} ${lastName} @ ${domain}`);
      return null;
    }

    // Check if email is masked (contains *)
    if (email.includes("*")) {
      console.log(`[Prospeo] Email masked for ${firstName} ${lastName}: ${email} — insufficient plan credits`);
      return null;
    }

    return {
      firstName: person.first_name || firstName,
      lastName: person.last_name || lastName,
      fullName: person.full_name || `${firstName} ${lastName}`.trim(),
      title: person.current_job_title || "",
      email,
      emailVerified: emailObj.status === "VERIFIED",
      linkedinUrl: person.linkedin_url || "",
    };
  } catch (err) {
    console.warn(`[Prospeo] enrich threw for ${firstName} ${lastName}:`, err.response?.data?.error_code || err.message);
    return null;
  }
}

export async function findDecisionMakers(companies) {
  if (!process.env.PROSPEO_API_KEY) throw new Error("Missing PROSPEO_API_KEY");

  const prospeo = getProspeo();
  const contacts = [];

  for (const company of companies) {
    if (!company.domain) continue;

    console.log(`[Prospeo] Processing: ${company.domain}`);
    await sleep(1500);

    const people = await searchPeopleAtDomain(prospeo, company.domain);
    if (people.length === 0) continue;

    for (const person of people) {
      const firstName = person.first_name || "";
      const lastName = person.last_name || "";
      const fullName = person.full_name || `${firstName} ${lastName}`.trim() || "Unknown";
      const personId = person.person_id || "";
      const linkedinUrl = person.linkedin_url || "";

      if (!personId) {
        console.log(`[Prospeo] No person_id for ${fullName}, skipping`);
        continue;
      }

      await sleep(1500);
      console.log(`[Prospeo] Enriching ${fullName} @ ${company.domain}...`);
      const enriched = await enrichPersonById(prospeo, personId, firstName, lastName, company.domain);

      if (!enriched) continue;

      contacts.push({
        ...enriched,
        companyName: company.name,
        companyDomain: company.domain,
        source: "prospeo-enrich",
      });
      console.log(`[Prospeo] ✓ ${enriched.fullName} <${enriched.email}>`);
    }
  }

  console.log(`[Prospeo] Done. Total contacts: ${contacts.length}`);
  return contacts;
}
*/
import axios from "axios";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getProspeo() {
  return axios.create({
    baseURL: "https://api.prospeo.io",
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "X-KEY": process.env.PROSPEO_API_KEY,
    },
  });
}

async function searchPeopleAtDomain(prospeo, domain) {
  try {
    const { data } = await prospeo.post("/search-person", {
      page: 1,
      filters: {
        company: { websites: { include: [domain] } },
      },
    });

    if (data.error) {
      console.warn(`[Prospeo] search-person error for ${domain}: ${data.error_code}`);
      return [];
    }

    const results = data.results || [];
    console.log(`[Prospeo] ${domain}: ${results.length} people found`);
    return results.slice(0, 2).map(r => r.person || r);
  } catch (err) {
    console.warn(`[Prospeo] search-person failed for ${domain}:`, err.response?.data?.error_code || err.message);
    return [];
  }
}

export async function findDecisionMakers(companies) {
  if (!process.env.PROSPEO_API_KEY) throw new Error("Missing PROSPEO_API_KEY");

  const prospeo = getProspeo();
  const contacts = [];

  for (const company of companies) {
    if (!company.domain) continue;
    await sleep(1200);

    const people = await searchPeopleAtDomain(prospeo, company.domain);

    for (const person of people) {
      const firstName = person.first_name || "";
      const lastName = person.last_name || "";
      const fullName = person.full_name || `${firstName} ${lastName}`.trim() || "Unknown";

      contacts.push({
        firstName,
        lastName,
        fullName,
        title: person.current_job_title || "",
        email: "", // free plan cannot reveal — pipelineController injects demo email
        emailVerified: false,
        linkedinUrl: person.linkedin_url || "",
        companyName: company.name,
        companyDomain: company.domain,
        source: "prospeo-search",
      });

      console.log(`[Prospeo] ✓ Found: ${fullName} (${person.current_job_title || "unknown title"}) @ ${company.name} — ${person.linkedin_url || "no linkedin"}`);
    }
  }

  console.log(`[Prospeo] Done. Real people found: ${contacts.length}`);
  return contacts;
}