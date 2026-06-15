# SignalSage — 5-Minute Demo Script

## Prerequisites

- Node.js 18+ installed
- Repository cloned and `npm install` completed
- Splunk Enterprise running locally (port 8089 for REST API, 8000 for Web UI)
- `.env.local` configured with SPLUNK_TOKEN and ALLOW_LIVE_SPL=true
- Data ingested via `node scripts/ingest-demo-data.js` or `node scripts/ingest-extended-data.js`

---

## Step 1: Start the App (30 seconds)

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

**Talking points:**
- "SignalSage is an AI-powered incident copilot that connects to your live Splunk instance."
- "It automates evidence correlation, root cause analysis, and report generation."
- "Built with Next.js 14, TypeScript, and Tailwind CSS — production-ready."

---

## Step 2: Welcome Page (15 seconds)

You'll see the SignalSage welcome page with a connection status indicator and an animated mascot.

Click the "Enter SignalSage" button. An explosion transition takes you into the main investigation interface.

**Talking points:**
- "The app verifies Splunk connectivity on load — the green badge confirms a live connection."
- "Everything you see from here is driven by real Splunk data."

---

## Step 3: Configure the Investigation (45 seconds)

On the **Select Incident** tab, you have two options:

1. **Quick Investigation** — Click "Investigate Last 30 Days" to scan all services
2. **Custom Investigation** — Expand the form to configure service, severity, sourcetype, and time range

Use the time range slider (1 day to 1 year, exponential scale) or pick exact start/end times.

**Talking points:**
- "You can target a specific service or scan everything with the 'All Services' option."
- "Severity filters let you focus on critical/high events or include all levels."
- "The sourcetype filter narrows to specific data formats: logs, metrics, traces, or deployments."

---

## Step 4: Investigation Results — Evidence Timeline (1 minute)

After clicking investigate, SignalSage:
1. Generates 12+ targeted SPL queries
2. Executes them against your Splunk instance in parallel
3. Runs ML-powered analysis (anomaly detection, clustering, forecasting)
4. Normalizes all results into a unified evidence timeline

Navigate to the **Investigation** tab. You'll see:
- A chronological timeline of all evidence collected
- Each item shows type (log, metric, trace, deployment), timestamp, and severity
- Click any item to see the underlying SPL query
- "Jump to Root Cause" and "Jump to Remediation" buttons for navigation

**Talking points:**
- "All evidence comes from live Splunk queries — no fake data."
- "Sensitive fields like tokens and passwords are automatically masked before display."
- "This replaces manually switching between 4-5 different Splunk dashboards."

---

## Step 5: Root Cause Analysis (1 minute)

Navigate to the **Root Cause** tab. You'll see ranked hypotheses:

- **Deployment Correlation** — Was a deploy near the incident start?
- **Dependency Timeout** — Are downstream services timing out?
- **Resource Exhaustion** — Are connection pools or memory saturated?
- **Error Spike** — Is there a systemic failure pattern?
- **Performance Degradation** — Are traces showing latency increases?

Each hypothesis shows a confidence percentage, supporting evidence, and a "Jump to Remediation" link.

**Talking points:**
- "Confidence scores are based on evidence scoring — boosted by ML anomaly detection results."
- "Multiple hypotheses can be true simultaneously (a deploy caused a timeout which caused pool exhaustion)."
- "The system presents probabilities, never false certainty."

---

## Step 6: Remediation Steps (30 seconds)

Navigate to the **Remediation** tab. You'll see an ordered checklist:

- Steps are grouped by hypothesis and ordered by priority
- Risk badges (low/medium/high) with estimated completion times
- High-risk actions flagged as requiring human approval
- Filter buttons to show All / Pending / Completed steps
- "Mark All Complete" button triggers a celebration animation

**Talking points:**
- "High-risk actions like rollbacks are never auto-executed — they require explicit approval."
- "Steps are actionable: they tell you exactly what to do and how long it takes."
- "Completing all steps triggers a visual celebration — small touches for team morale."

---

## Step 7: Post-Incident Report (30 seconds)

Navigate to the **Report** tab. You'll see a generated markdown report with:

- Executive summary
- Timeline of events
- Evidence table
- Root cause analysis
- Remediation checklist with statuses
- Follow-up action items

Click **Download Report** to save as markdown.

**Talking points:**
- "This saves 30-60 minutes of manual report writing after every incident."
- "The report is markdown — drop it into Confluence, Notion, Jira, or any wiki."
- "Follow-up items are suggested automatically based on root causes found."

---

## Step 8: Real-Time Monitor (30 seconds)

Navigate to the **Monitor** tab (always available). You'll see:

- 4 metric cards: Total Events, Error Count, Active Services, Avg Latency
- Live event feed with auto-refresh every 10 seconds
- Trend arrows showing metric changes
- Pause/Resume button to freeze the feed

**Talking points:**
- "This is a lightweight real-time operations dashboard powered by your Splunk data."
- "Useful for monitoring during and after an incident resolution."

---

## Step 9: Natural Language Query (30 seconds)

Navigate to the **Ask Data** tab. Type a question like:

- "Show me errors in the last hour"
- "What services have high latency?"
- "Show deployment events from today"

SignalSage translates natural language into SPL, runs it, and shows results.

**Talking points:**
- "No SPL expertise required — ask questions in plain English."
- "Under the hood it generates optimized SPL and shows you exactly what was run."

---

## Closing (15 seconds)

**Key differentiators:**
- Connects to real Splunk data — not a mock or simulation
- ML-powered analysis: anomaly detection, clustering, forecasting via MLTK
- Reduces Mean Time to Understand (MTTU) by automating evidence correlation
- Security-first: no token exposure, SPL injection prevention, field masking
- Natural language interface eliminates the SPL learning curve
- Proactive anomaly alerts running in the background

---

## Demo Tips

- Keep the browser at 100% zoom for readability
- Have some recent data in Splunk (run `node scripts/ingest-extended-data.js` beforehand)
- Use tab navigation to flow through the investigation naturally
- If asked about AI: "The analysis uses ML-boosted confidence scoring via Splunk MLTK, with hooks for Splunk AI Assistant integration"
- If asked about scale: "The architecture is modular — each analyzer can be replaced or extended independently"
- If asked about deployment: "Configured for Railway deployment, or any platform supporting Node.js"
