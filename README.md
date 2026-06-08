# VocalLabs Outreach Pipeline

> Fully automated cold-outreach pipeline — one domain in, emails out. Zero manual steps.
> Built for the **Vocallabs SDE Intern** take-home assignment.

---

## What This Does

You input a single company domain. The pipeline:
1. Discovers 10 lookalike companies using Ocean.io
2. Finds real decision-makers at each company using Prospeo (names, titles, LinkedIn URLs)
3. Pauses at a human review checkpoint — you approve or deselect contacts
4. Sends a hardcoded outreach email to every approved contact via Brevo

One input. Four stages. No copy-paste. No manual handoffs.

---

## Project Structure

```
outreach-pipeline/
├── client/                          React + Vite frontend
│   ├── src/
│   │   ├── components/              UI components
│   │   ├── pages/
│   │   │   └── Dashboard.jsx        Main pipeline UI
│   │   ├── services/                API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                          Node.js + Express backend
│   ├── config/                      Environment + app config
│   ├── controllers/
│   │   └── pipelineController.js    Pipeline orchestration logic
│   ├── routes/
│   │   └── pipelineRoutes.js        REST API endpoints
│   ├── services/
│   │   ├── oceanService.js          Stage 1 — Ocean.io lookalike finder
│   │   ├── prospeoService.js        Stage 2 — Prospeo people search
│   │   └── brevoService.js          Stage 3 — Brevo email sender
│   ├── utils/                       Shared helpers
│   ├── logs/                        Runtime logs
│   ├── server.js                    Express entry point
│   └── .env                         API keys (not committed)
│
├── .gitignore
├── package.json
└── README.md
```

---

## Pipeline Stages

| Stage | Tool | Input | Output |
|---|---|---|---|
| 1 | Ocean.io | Seed domain | 10 lookalike company domains |
| 2 | Prospeo | Company domains | Decision-makers + LinkedIn URLs |
| 3 | Human Checkpoint | Contact list | Approved contacts |
| 4 | Brevo | Approved contacts | Outreach emails sent |

> **Note:** The original assignment specified Eazyreach for Stage 3 (LinkedIn URL → verified work email). See the [Known Limitations](#known-limitations) section for why Prospeo is used instead and what that means for email resolution.

---

## Setup

### Prerequisites

- Node.js 18+
- Accounts at: [Ocean.io](https://ocean.io), [Prospeo](https://prospeo.io), [Brevo](https://brevo.com)
- A verified sender domain/email in Brevo (e.g. `hello@yourdomain.com`)

### 1. Clone and install

```bash
git clone https://github.com/MayurDas24/outreach-pipeline.git
cd outreach-pipeline

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment

Create `server/.env` with the following:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

# Ocean.io
OCEAN_API_KEY=your_ocean_api_key
OCEAN_RESULT_LIMIT=10

# Prospeo
PROSPEO_API_KEY=your_prospeo_api_key

# Brevo
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=hello@yourdomain.com
BREVO_SENDER_NAME=Your Name
BREVO_DRY_RUN=false

# Demo email — used when real emails cannot be revealed (see Known Limitations)
DEMO_FALLBACK_EMAIL=your@email.com
```

### 3. Run in development

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open http://localhost:5173

---

## How to Use

1. Enter a company domain (e.g. `stripe.com`) in the input box
2. Click **Run Pipeline →**
3. Watch the pipeline stages complete in real time:
   - Ocean.io finds 10 lookalike companies
   - Prospeo searches for decision-makers at each company
   - The pipeline pauses at the **Safety Checkpoint**
4. Review the contacts list — deselect anyone you want to skip
5. Click **Send to N →** to fire the emails via Brevo
6. See sent/failed results and the full pipeline log

---

## Safety Checkpoint

Before any email is sent, the pipeline always pauses and shows:
- Every resolved contact with their name, title, company, and email
- Checkboxes to deselect individual contacts
- A **Deselect All** option to cancel the send entirely

No email fires without explicit human approval at this step.

---

## Email Content

The outreach email is fully hardcoded on the backend (`server/services/brevoService.js`). Every contact receives the same message regardless of who they are. The subject and body describe this pipeline project itself — used as the outreach demo content.

To change what is sent, edit the `buildEmailContent()` function in `brevoService.js`.

---

## Known Limitations

### ⚠️ Eazyreach — Not Used (No Credits Available)

The original assignment pipeline was:
```
Ocean.io → Prospeo → Eazyreach → Brevo
```
Eazyreach was responsible for Stage 3: resolving LinkedIn profile URLs into verified work email addresses.

**The mentor clarified in the FAQ:**
> *"Eazyreach credits — Given the surge in applications, we are unable to provide credits for everyone at this point. Please use Prospeo itself as a replacement for Eazyreach to find people (and their LinkedIn and email IDs) and proceed with the automation."*

Prospeo was used as the replacement. It successfully finds real people at each company (real names, real titles, real LinkedIn URLs). However:

### ⚠️ Prospeo Free Plan — Email Addresses Cannot Be Revealed

Prospeo's free plan has a hard restriction: **email addresses are found but masked** (e.g. `a*******@bluesnap.com`) and cannot be revealed without a paid plan. All three available endpoints were attempted:

| Endpoint | Result |
|---|---|
| `/search-person` | ✅ Works — returns real people with names, titles, LinkedIn URLs |
| `/enrich-person` | ⚠️ Works but `revealed: false` — email exists but is masked on free plan |
| `/email-finder` | ❌ Returns `DEPRECATED` error on free plan |

**What this means for the demo:** Prospeo correctly finds real decision-makers (e.g. Abhishek Kumar at Razorpay, Hayley Norman at GoCardless) with their real LinkedIn URLs. Since their actual email addresses cannot be revealed on the free plan, **the pipeline routes all outreach emails to the developer's own email address** (`mayurrdas05@gmail.com`) to demonstrate that the full end-to-end flow works — Ocean → Prospeo → Checkpoint → Brevo send.

**In a production setup** with a paid Prospeo plan, the `/enrich-person` endpoint would return the real revealed email for each contact, and Brevo would send to them directly with zero code changes needed.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/pipeline/run` | Run Ocean + Prospeo stages, return contacts |
| `POST` | `/api/pipeline/send` | Send approved contacts via Brevo |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| Lookalike Discovery | Ocean.io API |
| People Search | Prospeo API |
| Email Sending | Brevo (Sendinblue) API |
| HTTP Client | Axios |

---

## Author

**Mayur Das**
GitHub: [github.com/MayurDas24](https://github.com/MayurDas24)

Built as a submission for the SDE Intern role at Subspace / VocalLabs.
Submission form: https://forms.gle/twfBdFvb6nrg5uzu7
