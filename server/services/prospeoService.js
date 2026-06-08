import axios from "axios";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getProspeo() {
  return axios.create({
    baseURL: "https://api.prospeo.io",
    timeout: 30000,
    headers: { "Content-Type": "application/json", "X-KEY": process.env.PROSPEO_API_KEY },
  });
}

// Search Person API — correct filter structure per docs
async function searchPeople(prospeo, domain) {
  const { data } = await prospeo.post("/search-person", {
    page: 1,
    filters: {
      company: { websites: { include: [domain] } },
      // Seniority filter uses exact enum values from docs
      person_seniority: { include: ["C-Suite", "Founder/Owner", "VP"] },
    },
  });

  if (data.error) {
    console.warn(`[Prospeo] search-person error for ${domain}:`, data.error_code);
    return [];
  }

  return (data.results || []).slice(0, 2);
}

// Enrich Person API — use person_id from search results (best match rate)
async function enrichPerson(prospeo, personId, company) {
  const { data } = await prospeo.post("/enrich-person", {
    only_verified_email: true,
    enrich_mobile: false,
    data: { person_id: personId },
  });

  if (data.error) {
    // NO_MATCH is normal — person exists but no verified email
    if (data.error_code !== "NO_MATCH") {
      console.warn(`[Prospeo] enrich-person error:`, data.error_code);
    }
    return null;
  }

  const person = data.person;
  if (!person) return null;

  // Email is at person.email.email per docs
  const email = person.email?.email || "";
  const emailVerified = person.email?.status === "VERIFIED" && person.email?.revealed === true;

  if (!email || !emailVerified) return null;

  return {
    firstName: person.first_name || "",
    lastName: person.last_name || "",
    fullName: person.full_name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown",
    title: person.current_job_title || "",
    email,
    emailVerified: true,
    linkedinUrl: person.linkedin_url || "",
    companyName: company.name,
    companyDomain: company.domain,
    source: "prospeo",
  };
}

export async function findDecisionMakers(companies) {
  if (!process.env.PROSPEO_API_KEY) throw new Error("Missing PROSPEO_API_KEY");

  const prospeo = getProspeo();
  const contacts = [];

  for (const company of companies) {
    if (!company.domain) continue;
    await sleep(1500);

    let people = [];
    try {
      people = await searchPeople(prospeo, company.domain);
      console.log(`[Prospeo] ${company.domain}: ${people.length} people in search results`);
    } catch (err) {
      console.warn(`[Prospeo] Search failed for ${company.domain}:`, err.response?.status, err.message);
      continue;
    }

    for (const person of people) {
      if (!person.person_id) continue;
      await sleep(1500);
      try {
        const enriched = await enrichPerson(prospeo, person.person_id, company);
        if (enriched) {
          contacts.push(enriched);
          console.log(`[Prospeo] ✓ ${enriched.fullName} <${enriched.email}>`);
        }
      } catch (err) {
        console.warn(`[Prospeo] Enrich failed:`, err.response?.status, err.message);
      }
    }
  }

  console.log(`[Prospeo] Total verified contacts: ${contacts.length}`);
  return contacts;
}