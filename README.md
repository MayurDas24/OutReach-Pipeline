# Outreach Pipeline

> Fully automated cold-outreach pipeline — one domain in, emails out. Zero manual steps.
> Built for the Vocallabs SDE take-home assignment.

---

## Architecture

```
outreach-pipeline/
├── backend/                  Node.js + Express API
│   └── src/
│       ├── stages/           One file per pipeline stage
│       │   ├── stage1_ocean.js      Ocean.io lookalike finder
│       │   ├── stage2_prospeo.js    Prospeo decision-maker search
│       │   ├── stage3_eazyreach.js  Eazyreach email resolver
│       │   └── stage4_brevo.js      Brevo transactional email sender
│       ├── services/
│       │   ├── pipelineOrchestrator.js  Stage wiring + checkpoint logic
│       │   └── emailTemplates.js        Personalized email copy
│       ├── middleware/
│       │   └── pipelineRoutes.js    REST + SSE endpoints
│       ├── utils/
│       │   ├── httpClient.js        Axios factory with retry + rate limiting
│       │   ├── pipelineEmitter.js   EventEmitter for SSE streaming
│       │   └── domainUtils.js       Domain validation + normalization
│       ├── config/
│       │   ├── env.js               Zod-validated env schema
│       │   └── logger.js            Winston structured logger
│       ├── server.js                Express entry point
│       └── cli.js                   CLI runner
└── frontend/                 React + Vite SPA
    └── src/
        ├── components/       UI components (CSS Modules)
        ├── hooks/usePipeline.js  SSE state machine
        └── utils/api.js      API client
```

## Pipeline Stages

| Stage | Tool | Input | Output |
|---|---|---|---|
| 1 | Ocean.io | Seed domain | Lookalike company domains |
| 2 | Prospeo | Company domains | Decision-makers + LinkedIn URLs |
| 3 | Eazyreach | LinkedIn URLs | Verified work emails |
| 4 | Brevo | Verified emails | Personalized outreach sent |

---

## Setup

### 1. Prerequisites

- Node.js 18+
- Accounts at: Ocean.io, Prospeo, Eazyreach, Brevo
- A domain with company email (e.g. `hello@mayurdev.site`)

### 2. Environment

```bash
cp backend/.env.example backend/.env
# Fill in all API keys
```

### 3. Install dependencies

```bash
npm install          # Root
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run in development

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Then open http://localhost:5173

---

## CLI Usage

Run the pipeline entirely from the terminal (no UI needed for the demo):

```bash
cd backend

# Standard run (with safety checkpoint prompt)
node src/cli.js stripe.com

# Dry run — resolves emails but doesn't send
node src/cli.js stripe.com --dry-run

# Auto-confirm checkpoint (non-interactive / CI)
node src/cli.js stripe.com --auto-confirm
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/pipeline/start` | Start a pipeline run |
| `GET` | `/api/pipeline/:runId/stream` | SSE event stream |
| `GET` | `/api/pipeline/:runId/state` | Current run state |
| `POST` | `/api/pipeline/:runId/confirm` | Confirm checkpoint |
| `POST` | `/api/pipeline/:runId/cancel` | Cancel at checkpoint |
| `GET` | `/api/health` | Health check |

---

## Safety Checkpoint

Before emails fire, the pipeline pauses and:
- Displays a full list of resolved contacts + emails
- Requires explicit confirmation (UI button or CLI `yes` prompt)
- Can be cancelled at this point — no emails will be sent

---

## Error Resilience

- **Retries**: 3 attempts with exponential backoff on 429/503/network errors
- **Rate limiting**: Honoured via `Retry-After` headers; manual delays between Eazyreach calls
- **Partial failure**: Single-domain failures in Stage 2 are logged and skipped; pipeline continues
- **Email deduplication**: LinkedIn URL-based dedup prevents duplicate outreach
- **Input validation**: Zod schemas on both env vars and API request bodies
- **Dry run mode**: Set `DRY_RUN=true` to test the full pipeline without sending

---

## Email Copy

Emails are personalized by seniority:
- CEOs/Founders get a brevity-first opener
- CTOs get an engineer-to-engineer tone
- COOs get an efficiency-focused angle
- VPs/Directors get a "solved the obvious problems" angle

Subject lines are consistent per company (hash-based rotation) so repeated runs don't create duplicates.

---

## Production Deployment

```bash
# Build frontend
cd frontend && npm run build

# Set NODE_ENV=production in backend/.env
# Start backend (serves React build as static files)
cd backend && npm start
```
