# SignalSage Requirements

## Project Overview
SignalSage is an AI-powered incident copilot for Splunk Observability. The application helps SRE, ITOps, and engineering teams investigate production incidents faster by combining Splunk logs, metrics, traces, alerts, and deployment events into a single AI-generated incident explanation and remediation plan.

## Hackathon Track
Observability

## Problem Statement
Engineering teams often lose valuable time during incidents because logs, metrics, traces, alerts, and deployment records are spread across multiple tools and require manual correlation. SignalSage reduces mean time to understand and mean time to respond by using AI to summarize incidents, generate investigation queries, identify likely root causes, and recommend remediation actions.

## Target Users
- Site Reliability Engineers
- Software Engineers on-call
- ITOps teams
- DevOps teams
- Engineering managers reviewing incidents

## Core User Stories

### Incident Intake
As an on-call engineer, I want to enter or select an active incident so that SignalSage can begin an investigation.

Acceptance Criteria:
- User can create an incident with title, affected service, severity, and time window.
- User can select from sample incidents in demo mode.
- System stores incident metadata locally or in a lightweight backend.

### Splunk Data Retrieval
As an engineer, I want SignalSage to retrieve relevant observability data from Splunk so that I do not have to manually search across multiple dashboards.

Acceptance Criteria:
- System can query Splunk logs using SPL.
- System can retrieve error counts, latency metrics, and service-specific logs.
- System supports configurable Splunk host, token, index, and service names.
- System provides mock/demo data if Splunk credentials are unavailable.

### AI-Generated Investigation
As an engineer, I want AI to generate investigation questions and SPL queries so that I can quickly understand the issue.

Acceptance Criteria:
- System generates candidate SPL searches from incident context.
- System explains the purpose of each generated query.
- System shows query results or demo results.
- System flags low-confidence or missing-data findings.

### Root Cause Summary
As an engineer, I want SignalSage to summarize the likely root cause with supporting evidence so that I can act confidently.

Acceptance Criteria:
- System produces an incident summary.
- System lists likely root cause hypotheses.
- System ranks hypotheses by confidence.
- System includes evidence from logs, metrics, traces, and deployments.
- System avoids claiming certainty when evidence is incomplete.

### Remediation Plan
As an engineer, I want suggested remediation steps so that I can respond faster.

Acceptance Criteria:
- System generates a step-by-step remediation checklist.
- System labels actions as safe, moderate-risk, or high-risk.
- System recommends human approval before destructive actions.
- System does not automatically perform production-impacting actions.

### Post-Incident Report
As an engineering manager, I want a generated incident report so that the team can document what happened.

Acceptance Criteria:
- System generates a markdown post-incident report.
- Report includes timeline, impact, root cause, evidence, remediation, and follow-up tasks.
- User can copy or download the report.

## Functional Requirements
1. Provide a web UI for incident creation and investigation.
2. Support Splunk connection configuration.
3. Support demo mode with synthetic observability data.
4. Generate SPL queries from natural-language investigation goals.
5. Execute or simulate SPL queries.
6. Summarize findings using an AI reasoning layer.
7. Generate remediation recommendations.
8. Generate post-incident reports.
9. Provide confidence scores and evidence links.
10. Log application errors for debugging.

## Non-Functional Requirements
1. The app should be usable in a live hackathon demo.
2. The app should run locally with minimal setup.
3. The app should not expose Splunk tokens in client-side code.
4. The app should handle failed Splunk API calls gracefully.
5. The app should support environment-variable configuration.
6. The UI should be simple, fast, and readable.
7. The system should be modular enough to replace mock data with real Splunk data.

## Security Requirements
1. Store Splunk credentials only in environment variables.
2. Never log API tokens.
3. Sanitize user input before using it in generated SPL.
4. Limit query time windows to prevent expensive searches.
5. Prevent arbitrary SPL execution unless explicitly enabled.
6. Require human confirmation for remediation recommendations.
7. Avoid exposing sensitive log fields in generated summaries.

## Demo Requirements
The demo must show:
1. A checkout latency incident.
2. AI-generated investigation queries.
3. Splunk-style evidence from logs and metrics.
4. Root cause summary.
5. Recommended remediation plan.
6. Generated post-incident markdown report.
