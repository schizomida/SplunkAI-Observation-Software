# SignalSage Architecture

## System Overview

SignalSage is a Next.js 14 application that orchestrates an AI-powered incident investigation pipeline. The system is designed as a layered architecture with clear separation between the UI, API, analysis logic, and data sources.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER                                       │
│                                                                         │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Incident    │  │  Query    │  │  Evidence    │  │  Root Cause  │  │
│  │  Selector    │→ │  Panel    │→ │  Timeline    │→ │  Card        │  │
│  └──────────────┘  └───────────┘  └──────────────┘  └──────────────┘  │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │  Remediation     │  │  Report          │                            │
│  │  Checklist       │→ │  Preview         │                            │
│  └──────────────────┘  └──────────────────┘                            │
│                                                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                          fetch (JSON)
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                         API LAYER (Next.js App Router)                   │
│                                                                         │
│  POST /api/incidents              Create/list incidents                  │
│  GET  /api/incidents/[id]         Get incident by ID                    │
│  POST /api/incidents/[id]/investigate   Run full investigation pipeline │
│  GET  /api/incidents/[id]/report        Generate post-incident report   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Security Layer                                                  │   │
│  │  • Input validation (Zod schemas)                               │   │
│  │  • Parameter length limits (128 chars)                          │   │
│  │  • ALLOW_LIVE_SPL guard                                         │   │
│  │  • Sensitive field masking                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                       ANALYSIS PIPELINE                                  │
│                                                                         │
│  ┌────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │ Query          │    │ Evidence            │    │ Root Cause      │  │
│  │ Generator      │    │ Normalizer          │    │ Analyzer        │  │
│  │                │    │                     │    │                 │  │
│  │ Generates 5    │    │ Normalizes logs,    │    │ 4 hypothesis    │  │
│  │ SPL templates  │    │ metrics, traces,    │    │ scorers ranked  │  │
│  │ per incident   │    │ deployments into    │    │ by confidence   │  │
│  └────────────────┘    │ typed EvidenceItems │    └────────┬────────┘  │
│                         └─────────────────────┘             │           │
│                                                             ▼           │
│  ┌────────────────┐    ┌─────────────────────┐                         │
│  │ Report         │ ←  │ Remediation         │                         │
│  │ Generator      │    │ Engine              │                         │
│  │                │    │                     │                         │
│  │ 6-section      │    │ Playbook-based      │                         │
│  │ markdown       │    │ steps with risk     │                         │
│  │ report         │    │ levels              │                         │
│  └────────────────┘    └─────────────────────┘                         │
│                                                                         │
└──────────┬──────────────────────────────────────────────┬───────────────┘
           │                                              │
           ▼                                              ▼
┌─────────────────────────┐              ┌────────────────────────────────┐
│   SPLUNK REST API       │              │   DEMO DATA LAYER              │
│                         │              │                                │
│  • SPL query execution  │              │  data/demo/incidents.json      │
│  • Search job lifecycle │              │  data/demo/logs.json           │
│  • Configurable host,   │              │  data/demo/metrics.json        │
│    token, index         │              │  data/demo/deployments.json    │
│  • MAX_TIME_WINDOW cap  │              │  data/demo/traces.json         │
│  • SPL injection guard  │              │                                │
└─────────────────────────┘              └────────────────────────────────┘
```

## Layer Descriptions

### 1. Browser Layer (React Components)

The UI is built with React components rendered by Next.js. Each component handles one step of the investigation flow:

| Component | Responsibility |
|-----------|---------------|
| `IncidentSelector` | Select demo incident or create a new one |
| `QueryPanel` | Display generated SPL queries with explanations |
| `EvidenceTimeline` | Chronological timeline of evidence items |
| `RootCauseCard` | Hypothesis cards with confidence bars |
| `RemediationChecklist` | Ordered steps with risk badges |
| `ReportPreview` | Markdown preview with download button |
| `ErrorBoundary` | Catches render errors with retry |
| `LoadingSkeleton` | Loading states during API calls |

### 2. API Layer (Next.js App Router)

Server-side route handlers that orchestrate the investigation pipeline. All routes enforce:
- Input validation via Zod schemas
- Parameter sanitization (max 128 characters)
- ALLOW_LIVE_SPL guard for live Splunk queries
- Sensitive field masking before returning data to the client

### 3. Analysis Pipeline

The core business logic, organized as a pipeline of pure functions:

1. **Query Generator** — Produces 5 SPL query templates from incident metadata (error rate, latency percentiles, deployment correlation, dependency timeout, host impact)
2. **Evidence Normalizer** — Converts raw log/metric/trace/deployment data into typed `EvidenceItem[]` with consistent timestamps and masked sensitive fields
3. **Root Cause Analyzer** — Runs 4 hypothesis scorers (deployment correlation, error spike, dependency timeout, resource exhaustion) and ranks results by confidence
4. **Remediation Engine** — Maps hypotheses to playbook-based remediation steps with risk levels and approval requirements
5. **Report Generator** — Produces a 6-section markdown post-incident report

### 4. Data Sources

- **Splunk REST API** — Used when `ALLOW_LIVE_SPL=true` and credentials are configured. Queries are built with `buildSafeQuery` which validates all parameters against an allowlist regex.
- **Demo Data** — JSON fixtures in `data/demo/` providing realistic synthetic data for the checkout latency incident. Used by default (no credentials required).

## Data Flow

```
1. User selects incident
       │
       ▼
2. POST /api/incidents/[id]/investigate
       │
       ├─── queryGenerator.generateQueries(incident)
       │         → 5 InvestigationQuery objects
       │
       ├─── demoLoader / splunkClient
       │         → raw logs, metrics, traces, deployments
       │
       ├─── evidenceNormalizer.normalizeAll(rawData)
       │         → EvidenceItem[]
       │
       ├─── rootCauseAnalyzer.analyzeRootCause(evidence)
       │         → RootCauseHypothesis[] (sorted by confidence)
       │
       ├─── remediationEngine.generateRemediation(hypotheses)
       │         → RemediationStep[]
       │
       └─── maskSensitiveFields(evidence)
                 → sanitized evidence returned to client
       │
       ▼
3. Client renders results across tabs

4. GET /api/incidents/[id]/report
       │
       └─── reportGenerator.generateReport(incident, result)
                 → IncidentReport with markdown
```

## Security Architecture

- **Token isolation** — `SPLUNK_TOKEN` is only accessed in `lib/splunk/` (server-side only)
- **SPL injection prevention** — All query parameters validated against `/^[a-zA-Z0-9\-_./:]+$/`
- **Time window cap** — `MAX_TIME_WINDOW_HOURS` prevents unbounded Splunk queries
- **Live query guard** — `ALLOW_LIVE_SPL` must be explicitly enabled
- **Field masking** — Sensitive fields (token, password, secret, key, etc.) are recursively masked before client delivery
- **Input validation** — All API parameters validated with Zod schemas and length limits
