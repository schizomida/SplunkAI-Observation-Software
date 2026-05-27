# SignalSage Implementation Plan

## Architecture

SignalSage is a full-stack Next.js 14 application using the App Router. All Splunk API calls and AI orchestration happen server-side via API routes. The client receives only sanitized, normalized data.

### Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **AI Layer**: Template-based reasoning engine (demo); optional OpenAI/Bedrock integration
- **Splunk Integration**: Server-side REST API client (Node.js fetch)
- **Demo Data**: Local JSON fixtures in `/data/demo`
- **Testing**: Jest + React Testing Library
- **Report Export**: Client-side Markdown download (Blob API)

---

## Reviewer Analysis

### Security Reviewer
- Splunk tokens are read from `process.env` only in API routes — never passed to the client.
- All user-supplied service names and time windows are validated and sanitized before SPL interpolation.
- SPL execution is gated behind an `ALLOW_LIVE_SPL=true` env flag; demo mode is the default.
- Sensitive log fields (passwords, tokens, PII patterns) are stripped in the evidence normalizer before any AI summarization.
- API routes validate request bodies with Zod schemas to prevent injection via JSON payloads.
- Remediation actions are read-only suggestions; no automated execution path exists.

### Performance Reviewer
- Demo mode returns pre-computed JSON fixtures with no network calls — sub-100ms response.
- Live Splunk queries use a 15-minute default time window cap to prevent runaway searches.
- Splunk search jobs are polled with exponential backoff (max 30s timeout).
- Next.js API routes are stateless; no in-memory state accumulates between requests.
- Evidence normalization is O(n) over evidence items; no nested loops.
- Report generation is pure string concatenation — no heavy serialization.

### Data Contract Reviewer
- All shared types are defined in `/types/index.ts` and imported by both API routes and UI components.
- API responses follow a consistent `{ data, error }` envelope.
- Demo fixtures conform to the same TypeScript types as live Splunk responses.
- Evidence items carry a `source: 'demo' | 'splunk'` discriminator so the UI can label them correctly.
- Zod schemas are co-located with types and used for both runtime validation and TypeScript inference.

### Demo Reliability Reviewer
- Demo mode requires zero external dependencies — works fully offline.
- The checkout latency incident is pre-loaded on app start; no user configuration needed.
- All demo data is deterministic (no random values) so the demo looks identical on every run.
- Loading states are simulated with a 1.2s artificial delay to make the AI "thinking" feel realistic.
- Error states are tested with a `?forceError=true` query param for demo purposes.

### Hackathon Judge Reviewer
- The app opens to a compelling incident dashboard, not a configuration screen.
- The demo incident (checkout latency + Redis timeout + payment-service deploy) tells a clear story.
- Root cause cards use confidence percentages and color-coded severity badges.
- The generated SPL queries are realistic and copy-pasteable into a real Splunk instance.
- The post-incident report downloads as a properly formatted `.md` file.
- The README includes a one-command setup (`npm install && npm run dev`).

---

## Refined Implementation Plan

### Phase 1 — Project Bootstrap
Set up Next.js 14 with TypeScript, Tailwind, Jest, and folder structure. Configure `.env.example`. Establish the base layout with a sidebar and main content area.

### Phase 2 — Type System
Define all shared TypeScript types and Zod validation schemas. This is the data contract foundation that all other phases depend on.

### Phase 3 — Demo Data
Create realistic JSON fixtures for the checkout latency incident: logs with Redis timeouts, latency metrics, a payment-service deployment event, and distributed traces. Build a demo data loader that returns typed objects.

### Phase 4 — Splunk Client
Build a server-side Splunk REST client with configuration loading, safe SPL query construction, search job creation, result polling, and graceful fallback to demo mode when credentials are absent.

### Phase 5 — Query Generator
Build a template-based SPL query generator. Given an incident context, produce a set of investigation questions, each with a corresponding SPL query, plain-English explanation, and risk label.

### Phase 6 — Evidence Normalizer
Normalize heterogeneous evidence (logs, metrics, traces, deployments) into a common `EvidenceItem` shape. Strip sensitive fields. Group by service and timestamp.

### Phase 7 — Root Cause Analyzer
Score evidence against a set of hypothesis templates (deployment correlation, error spike, dependency timeout, resource exhaustion). Rank hypotheses by confidence. Generate plain-English explanations.

### Phase 8 — Remediation Engine
Map root cause types to remediation playbooks. Label each step by risk (safe / moderate / high). Prepend a human-approval warning to any destructive action.

### Phase 9 — Report Generator
Assemble a Markdown post-incident report from incident metadata, timeline, evidence, root cause, remediation, and follow-up tasks. Expose a download endpoint.

### Phase 10 — UI
Build the full React UI: landing page, incident selector, investigation dashboard, SPL query panel, evidence timeline, root cause cards, remediation checklist, and report preview with download.

### Phase 11 — Security Hardening
Audit token handling, SPL sanitization, field masking, and time window limits. Add security notes to README.

### Phase 12 — Hackathon Polish
Write README, add architecture diagram, create demo script, add sample report, prepare pitch materials.

---

## Folder Structure

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       ├── incidents/
│       │   ├── route.ts              # POST /api/incidents
│       │   └── [id]/
│       │       ├── route.ts          # GET /api/incidents/:id
│       │       ├── investigate/
│       │       │   └── route.ts      # POST /api/incidents/:id/investigate
│       │       └── report/
│       │           └── route.ts      # GET /api/incidents/:id/report
├── components/
│   ├── IncidentSelector.tsx
│   ├── InvestigationDashboard.tsx
│   ├── QueryPanel.tsx
│   ├── EvidenceTimeline.tsx
│   ├── RootCauseCard.tsx
│   ├── RemediationChecklist.tsx
│   └── ReportPreview.tsx
├── lib/
│   ├── splunk/
│   │   ├── client.ts
│   │   ├── queryBuilder.ts
│   │   └── config.ts
│   ├── analysis/
│   │   ├── queryGenerator.ts
│   │   ├── evidenceNormalizer.ts
│   │   └── rootCauseAnalyzer.ts
│   └── reporting/
│       └── reportGenerator.ts
├── data/
│   └── demo/
│       ├── incidents.json
│       ├── logs.json
│       ├── metrics.json
│       ├── traces.json
│       └── deployments.json
├── types/
│   └── index.ts
├── tests/
│   ├── lib/
│   └── components/
├── .env.example
└── README.md
```

---

## API Contract

### POST /api/incidents
Request: `{ title, service, severity, startTime, endTime, mode }`
Response: `{ data: Incident, error: null }`

### GET /api/incidents/:id
Response: `{ data: Incident, error: null }`

### POST /api/incidents/:id/investigate
Response: `{ data: InvestigationResult, error: null }`

InvestigationResult:
```typescript
{
  queries: InvestigationQuery[];
  evidence: EvidenceItem[];
  hypotheses: RootCauseHypothesis[];
  remediation: RemediationStep[];
}
```

### GET /api/incidents/:id/report
Response: `{ data: { markdown: string }, error: null }`

---

## Environment Variables

```
SPLUNK_HOST=
SPLUNK_TOKEN=
SPLUNK_INDEX=main
SPLUNK_SERVICE=checkout-service
ALLOW_LIVE_SPL=false
DEMO_MODE=true
OPENAI_API_KEY=          # optional, for AI-enhanced summaries
```
