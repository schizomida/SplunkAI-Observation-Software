# SignalSage — 5-Minute Demo Script

## Prerequisites

- Node.js 18+ installed
- Repository cloned and `npm install` completed
- No Splunk credentials needed (demo mode is default)

---

## Step 1: Start the App (30 seconds)

```bash
npm run dev
```

Open http://t:3000 in your browser.

**Talking points:**
- "SignalSage is real-world deployment-ready."
- "In production, you'd configure SPLUNK_HOST and SPLUNK_TOKEN to connect to a real Splunk instance."
- "The app is built with Next.js 14, TypeScript, and Tailwind CSS."

---

## Step 2: Select the Demo Incident (30 seconds)

On the main page, you'll see the **Checkout Service Latency Spike** incident card.

Click the incident card to begin the investigation.

**Talking points:**
- "This is a realistic incident: P99 checkout latency spiked from 120ms to 4,200ms."
- "The incident affected the checkout-service and lasted 30 minutes."
- "In a real scenario, this could be triggered by a PagerDuty or Splunk On-Call alert."

---

## Step 3: Review Investigation Queries (1 minute)

Navigate to the **Queries** tab. You'll see 5 generated SPL investigation queries:

1. **Error Rate Spike** — Searches for error-level events in the affected service
2. **Latency Percentiles** — Calculates p50/p95/p99 latency during the incident window
3. **Deployment Correlation** — Finds deployments near the incident start time
4. **Dependency Timeout** — Searches for timeout events in downstream services
5. **Host/Pod Impact** — Identifies which hosts or pods were most affected

**Talking points:**
- "SignalSage automatically generates targeted SPL queries from the incident context."
- "Each query has a clear purpose and explanation — no SPL expertise required."
- "All queries are validated against injection patterns before execution."
- "The time window is automatically scoped to the incident duration."

---

## Step 4: Explore the Evidence Timeline (1 minute)

Navigate to the **Evidence** tab. You'll see a chronological timeline showing:

- **Deployment event** — payment-service v2.4.1 deployed 8 minutes before the incident
- **Log entries** — Redis timeout errors, retry exhaustion warnings, slow query logs
- **Metrics** — P99 latency spike, error rate increase, Redis connection pool saturation
- **Traces** — Distributed traces showing checkout → payment → redis span slowdowns

**Talking points:**
- "All evidence is normalized into a single timeline regardless of source type."
- "Each item shows its type (log, metric, trace, deployment), timestamp, and severity."
- "Sensitive fields like tokens and passwords are automatically masked."
- "This replaces the manual process of switching between 4-5 different dashboards."

---

## Step 5: Analyze Root Cause Hypotheses (1 minute)

Navigate to the **Root Cause** tab. You'll see ranked hypotheses:

1. **Deployment Correlation** (~70% confidence) — A deployment occurred close to incident start
2. **Dependency Timeout** (~75% confidence) — Multiple timeout events in downstream dependencies
3. **Resource Exhaustion** (~70% confidence) — Redis connection pool saturation detected
4. **Error Spike** (~70% confidence) — Significant spike in error logs

**Talking points:**
- "SignalSage ranks hypotheses by confidence based on evidence scoring."
- "Each hypothesis shows supporting evidence IDs so you can trace back to raw data."
- "The system avoids claiming certainty — it presents probabilities, not conclusions."
- "Multiple hypotheses can be true simultaneously (deployment caused the timeout which caused resource exhaustion)."

---

## Step 6: Review Remediation Steps (30 seconds)

Navigate to the **Remediation** tab. You'll see an ordered checklist:

- ✅ Low-risk: Verify deployment diff (5 min)
- ⚠️ High-risk: Roll back to previous version (10 min) — REQUIRES APPROVAL
- ✅ Low-risk: Validate rollback success (5 min)
- ✅ Low-risk: Check dependency health (5 min)
- ⚠️ Medium-risk: Increase timeout thresholds (10 min)

**Talking points:**
- "Steps are ordered by priority and grouped by hypothesis."
- "High-risk actions are flagged and require human approval before execution."
- "SignalSage never automatically performs production-impacting actions."
- "Each step includes estimated time so you can plan your response."

---

## Step 7: Download the Report (30 seconds)

Navigate to the **Report** tab. You'll see a preview of the generated post-incident report.

Click **Download Report** to save the markdown file.

**Talking points:**
- "The report includes 6 sections: executive summary, timeline, evidence table, root cause analysis, remediation checklist, and follow-up items."
- "It's generated as markdown so it can be pasted into Confluence, Notion, or any wiki."
- "This saves 30-60 minutes of manual report writing after every incident."
- "Follow-up items are automatically suggested based on the root causes found."

---

## Closing (15 seconds)

**Key takeaways:**
- SignalSage reduces MTTU (Mean Time to Understand) by automating evidence correlation
- Works with real Splunk data or demo mode for evaluation
- Security-first: no token exposure, SPL injection prevention, field masking
- Generates actionable reports that save hours of post-incident documentation

---

## Demo Tips

- Keep the browser at 100% zoom for readability
- Use the tab navigation to move through the flow naturally
- If asked about AI: "The analysis pipeline uses rule-based scoring today, with hooks for LLM-enhanced summaries via OpenAI"
- If asked about scale: "The architecture is modular — each analyzer can be replaced or extended independently"
