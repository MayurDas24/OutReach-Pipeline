import axios from "axios";

function cleanDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function mapCompany(row) {
  const c = row.company || row;
  return {
    name: c.name || c.legalName || c.domain || "Unknown",
    domain: c.domain || "",
    description: c.description || "",
    linkedinUrl: c.medias?.linkedin?.url || "",
    industry: c.industries?.[0] || c.industryCategories?.[0] || "",
    size: c.companySize || "",
    country: c.primaryCountry || "",
  };
}

export async function findLookalikeCompanies(seedDomain) {
  if (!process.env.OCEAN_API_KEY) {
    throw new Error("Missing OCEAN_API_KEY in server/.env");
  }

  const domain = cleanDomain(seedDomain);
  const limit = Number(process.env.OCEAN_RESULT_LIMIT || 10);

  const payload = {
    size: limit,
    companiesFilters: {
      lookalikeDomains: [domain],
      excludeDomains: [domain],
    },
  };

  try {
    // Create axios instance INSIDE the function so it reads the key
    // after dotenv.config() has already run in server.js
    const { data } = await axios.post(
      "https://api.ocean.io/v3/search/companies",
      payload,
      {
        timeout: 30000,
        headers: {
          "Content-Type": "application/json",
          "x-api-token": process.env.OCEAN_API_KEY,
        },
      }
    );

    const companies = (data.companies || [])
      .map(mapCompany)
      .filter((c) => c.domain);

    console.log(`[Ocean] Success: ${companies.length} lookalike companies for ${domain}`);
    return companies;
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.response?.data || error.message;
    console.error("[Ocean] Failed:", status, detail);
    throw new Error(
      `Ocean.io failed (${status || "no-status"}). Detail: ${JSON.stringify(detail)}`
    );
  }
}