# SignalSage

> AI-powered incident copilot for Splunk Observability

SignalSage helps SRE, ITOps, and engineering teams investigate production incidents faster by combining logs, metrics, traces, alerts, and deployment events into an AI-generated root cause summary, remediation checklist, and post-incident report.

---

## Quick Start (Demo Mode — No Splunk Required)

```bash
git clone <this-repo>
cd SplunkAI-Observation-Software
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — click **"Use Demo Incident"** to explore the full investigation flow with synthetic data.

---

## Full Setup (Live Splunk Mode)

To run SignalSage against a real local Splunk Enterprise instance:

### Prerequisites

- **Node.js 18+**
- **Splunk Enterprise** running locally (free Developer license works)
  - Web UI: http://localhost:8000
  - REST API: https://localhost:8089
  - HEC: https://localhost:8088

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Create Splunk Auth Token

1. Open Splunk Web at http://localhost:8000
2. Go to **Settings → Tokens** (under Users and Authentication)
3. Click **New Token**
4. Set User to your admin user, Audience to `SignalSage`, Expiration to 30 days
5. Click **Create** and copy the token value

### Step 3: Enable HTTP Event Collector (HEC)

1. Go to **Settings → Data Inputs → HTTP Event Collector**
2. Click **Global Settings** → set **All Tokens** to **Enabled** → Save
3. Click **New Token** → name it `SignalSage` → Next → set **Source Type** to `Automatic` → Review → Submit
4. Copy the HEC token value

### Step 4: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
SPLUNK_HOST=localhost
SPLUNK_PORT=8089
SPLUNK_TOKEN=<your-auth-token-from-step-2>
SPLUNK_INDEX=main

SPLUNK_HEC_TOKEN=<your-hec-token-from-step-3>
SPLUNK_HEC_PORT=8088

ALLOW_LIVE_SPL=true
MAX_TIME_WINDOW_HOURS=24
```

### Step 5: Ingest Demo Data into Splunk

This loads realistic incident data (logs, metrics, traces, deployments) into your Splunk instance:

```bash
node scripts/ingest-demo-data.js
```

You should see:
```
=== SignalSage Demo Data Ingestion ===
  ✓ 15 log events ingested
  ✓ 30 metric events ingested
  ✓ 12 trace span events ingested
  ✓ 1 deployment events ingested
=== Done! 58 total events ingested ===
```

### Step 6: Run the App

```bash
npm run dev
```

Open http://localhost:3000 and click **"🔍 Investigate Last 30 Minutes"** to query your live Splunk instance.

---

## How It Works

### Two Modes

| Mode | How to Use | Data Source |
|------|-----------|-------------|
| **Demo** | Click "Use Demo Incident" | Built-in JSON fixtures |
| **Live** | Click "Investigate Last 30 Minutes" or custom form | Real Splunk queries via REST API |

When `ALLOW_LIVE_SPL=true` and a valid `SPLUNK_TOKEN` is configured, the app queries your Splunk instance directly. If Splunk is unavailable or returns no results, it falls back to demo data gracefully.

### Investigation Pipeline

1. **Query Generation** — Creates 5 targeted SPL queries (error rate, latency, deployments, timeouts, host impact)
2. **Evidence Collection** — Runs queries against Splunk (or loads demo fixtures)
3. **Root Cause Analysis** — Scores 4 hypothesis types by confidence
4. **Remediation** — Generates ordered playbook steps with risk levels
5. **Report** — Produces a downloadable markdown post-incident report

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React UI)                       │
│  IncidentSelector → QueryPanel → Timeline → RootCause →    │
│  RemediationChecklist → ReportPreview                       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP (fetch)
┌────────────────────────────▼────────────────────────────────┐
│                  Next.js API Routes                          │
│  /api/incidents  /api/incidents/[id]/investigate  /report    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                  Analysis Pipeline                           │
│  queryGenerator → liveEvidenceCollector → rootCauseAnalyzer  │
│  → remediationEngine → reportGenerator                      │
└──────────┬─────────────────────────────────┬────────────────┘
           │                                 │
┌──────────▼──────────┐         ┌────────────▼───────────────┐
│   Splunk REST API   │         │   Demo Data (JSON fixtures) │
│   (port 8089)       │         │   (fallback, no creds)      │
└─────────────────────┘         └────────────────────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for a detailed breakdown.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SPLUNK_HOST` | `localhost` | Splunk REST API hostname |
| `SPLUNK_PORT` | `8089` | Splunk REST API port |
| `SPLUNK_TOKEN` | — | Splunk auth token (Settings → Tokens) |
| `SPLUNK_INDEX` | `main` | Splunk index to search |
| `SPLUNK_HEC_TOKEN` | — | HEC token (for data ingestion script) |
| `SPLUNK_HEC_PORT` | `8088` | HEC port |
| `ALLOW_LIVE_SPL` | `false` | Enable live Splunk queries |
| `MAX_TIME_WINDOW_HOURS` | `24` | Max query time window (hours) |

---

## Project Structure

```
app/              Next.js App Router pages and API routes
components/       React UI components
lib/
  splunk/         Splunk REST client, config, query builder
  analysis/       Query generation, evidence collection, root cause, remediation
  reporting/      Markdown report generator
data/demo/        Synthetic demo data fixtures
scripts/          Utility scripts (data ingestion)
types/            Shared TypeScript types
tests/            Unit and integration tests (402 tests)
docs/             Architecture docs, demo script, sample report
```

---

## Running Tests

```bash
npm test
```

All 402 tests pass covering validation schemas, analysis pipeline, API routes, and security.

---

## Security

- **SPLUNK_TOKEN is server-side only** — never exposed to the client bundle
- **Sensitive field masking** — tokens, passwords, secrets are recursively masked with `***` before returning to client
- **SPL injection prevention** — allowlist regex validates all query parameters
- **MAX_TIME_WINDOW_HOURS cap** — prevents unbounded Splunk queries
- **ALLOW_LIVE_SPL guard** — live queries disabled by default
- **Input validation** — Zod schemas + parameter length limits on all API routes
- **Self-signed cert handling** — TLS verification disabled only for local Splunk connections

---

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **Zod** for schema validation
- **Jest** + React Testing Library
- **Splunk REST API** (port 8089) + **HEC** (port 8088)

---

## Hackathon Track

Splunk AI Hackathon — Observability Track
