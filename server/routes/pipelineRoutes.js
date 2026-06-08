import express from "express";
import { runPipeline, sendApprovedEmails } from "../controllers/pipelineController.js";

const router = express.Router();

// Stage 1+2: Ocean → Prospeo → return checkpoint data
router.post("/run", runPipeline);

// Stage 4: Send approved contacts via Brevo
router.post("/send", sendApprovedEmails);

export default router;
