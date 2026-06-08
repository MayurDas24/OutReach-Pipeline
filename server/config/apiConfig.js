import dotenv from "dotenv";
dotenv.config();

export const API_CONFIG = {
  ocean: {
    baseURL: "https://api.ocean.io/v3",
    apiKey: process.env.OCEAN_API_KEY,
  },
  prospeo: {
    baseURL: "https://api.prospeo.io/v1",
    apiKey: process.env.PROSPEO_API_KEY,
  },
  brevo: {
    baseURL: "https://api.brevo.com/v3",
    apiKey: process.env.BREVO_API_KEY,
  },
};
