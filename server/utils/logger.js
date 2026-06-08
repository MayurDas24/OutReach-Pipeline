import fs from "fs";
import path from "path";

const LOG_DIR = "logs";
const LOG_FILE = path.join(LOG_DIR, "pipeline.log");

// Ensure logs dir exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const logMessage = (message, level = "INFO") => {
  const timestamp = new Date().toISOString();
  const finalMessage = `[${timestamp}] [${level}] ${message}\n`;
  console.log(finalMessage.trim());
  fs.appendFileSync(LOG_FILE, finalMessage);
};

export const logError = (message) => logMessage(message, "ERROR");
export const logSuccess = (message) => logMessage(message, "SUCCESS");
