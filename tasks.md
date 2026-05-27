        # SignalSage Tasks

## Task 1: Project Bootstrap

Set up the Next.js 14 project with TypeScript, Tailwind CSS, Jest, and the full folder structure defined in the implementation plan.

- [x] 1.1 Initialize Next.js 14 app with TypeScript using `npx create-next-app@latest` with flags: `--typescript --tailwind --app --no-src-dir --import-alias "@/*"`
- [x] 1.2 Install dev dependencies: `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`, `ts-jest`, `@types/jest`
- [x] 1.3 Install runtime dependencies: `zod`, `uuid`, `@types/uuid`
- [x] 1.4 Configure `jest.config.ts` for Next.js + TypeScript
- [x] 1.5 Create `jest.setup.ts` importing `@testing-library/jest-dom`
- [x] 1.6 Create `.env.example` with all required environment variables
- [x] 1.7 Create folder structure: `components/`, `lib/splunk/`, `lib/analysis/`, `lib/reporting/`, `data/demo/`, `types/`, `tests/lib/`, `tests/components/`
- [x] 1.8 Create placeholder `README.md` with project name and one-command setup instructions
- [x] 1.9 Verify `npm run dev` starts without errors and `npm test` runs without errors

## Task 2: Type System and Data Contracts

Define all shared TypeScript types and Zod validation schemas that form the data contract between API routes and UI components. Depends on Task 1.

- [x] 2.1 Create `types/index.ts` with types: `Severity`, `IncidentMode`, `Incident`, `InvestigationQuery`, `EvidenceItem`, `RootCauseHypothesis`, `RemediationStep`, `InvestigationResult`, `IncidentReport`, `ApiResponse<T>`
- [x] 2.2 Create `lib/validation.ts` with Zod schemas matching each type
- [x] 2.3 Write unit tests in `tests/lib/validation.test.ts` covering valid and invalid inputs for each schema

## Task 3: Demo Data Fixtures

Create realistic JSON fixtures for the checkout latency incident and a typed demo data loader. Depends on Task 2.

- [x] 3.1 Create `data/demo/incidents.json` with one checkout latency incident (id: `demo-001`, service: `checkout-service`, severity: `high`, 30-minute window)
- [x] 3.2 Create `data/demo/logs.json` with 12-15 log entries including Redis timeout errors, retry exhaustion warnings, slow query logs
- [x] 3.3 Create `data/demo/metrics.json` with time-series data for p99 checkout latency spike, error rate spike, Redis connection pool saturation
- [x] 3.4 Create `data/demo/deployments.json` with one payment-service deployment event 8 minutes before incident start
- [x] 3.5 Create `data/demo/traces.json` with 3 distributed traces showing checkout → payment → redis span slowdowns
- [x] 3.6 Create `lib/analysis/demoLoader.ts` that imports all fixtures and returns typed `EvidenceItem[]` and `Incident` objects
- [x] 3.7 Write unit tests in `tests/lib/demoLoader.test.ts` verifying the loader returns correctly typed data

## Task 4: Splunk Client

Build the server-side Splunk REST client with configuration loading, safe SPL construction, search job lifecycle, and demo fallback. Depends on Task 2.

- [x] 4.1 Create `lib/splunk/config.ts` that reads env vars and returns a typed config object
- [x] 4.2 Create `lib/splunk/queryBuilder.ts` with a `buildSafeQuery` function that validates params against an allowlist regex and interpolates them
- [x] 4.3 Create `lib/splunk/client.ts` with `createSearchJob`, `pollSearchResults`, `runQuery`, and `isConfigured` functions
- [x] 4.4 Write unit tests in `tests/lib/splunk/queryBuilder.test.ts` covering valid interpolation and rejection of injection patterns
- [x] 4.5 Write unit tests in `tests/lib/splunk/config.test.ts` covering missing credentials and demo mode defaults

## Task 5: SPL Query Generator

Build the template-based investigation query generator. Depends on Task 4.

- [x] 5.1 Create `lib/analysis/queryGenerator.ts` with `generateQueries(incident: Incident): InvestigationQuery[]`
- [x] 5.2 Implement 5 query templates: error rate spike, latency percentiles, deployment correlation, dependency timeout, host/pod impact
- [x] 5.3 Write unit tests in `tests/lib/queryGenerator.test.ts` verifying 5 queries are returned with all required fields

## Task 6: Evidence Normalizer

Build the evidence normalizer that converts raw data into typed `EvidenceItem[]`. Depends on Task 2.

- [x] 6.1 Create `lib/analysis/evidenceNormalizer.ts` with `normalizeLog`, `normalizeMetric`, `normalizeTrace`, `normalizeDeployment`, `normalizeAll`, and `maskSensitiveFields` functions
- [x] 6.2 Write unit tests in `tests/lib/evidenceNormalizer.test.ts` covering type assignment, sensitive field masking, and timestamp normalization

## Task 7: Root Cause Analyzer

Build the scoring engine that ranks root cause hypotheses by confidence. Depends on Task 6.

- [x] 7.1 Create `lib/analysis/rootCauseAnalyzer.ts` with `analyzeRootCause(evidence: EvidenceItem[]): RootCauseHypothesis[]`
- [x] 7.2 Implement 4 hypothesis scorers: deployment correlation, error spike, dependency timeout, resource exhaustion
- [x] 7.3 Write unit tests in `tests/lib/rootCauseAnalyzer.test.ts` covering scoring logic and sort order

## Task 8: Remediation Engine

Build the remediation step generator. Depends on Task 7.

- [x] 8.1 Create `lib/analysis/remediationEngine.ts` with `generateRemediation(hypotheses: RootCauseHypothesis[]): RemediationStep[]`
- [x] 8.2 Implement remediation playbooks for each hypothesis type with risk labels and approval flags
- [x] 8.3 Write unit tests in `tests/lib/remediationEngine.test.ts` covering risk levels and approval requirements

## Task 9: Report Generator

Build the Markdown post-incident report generator. Depends on Task 7 and Task 8.

- [x] 9.1 Create `lib/reporting/reportGenerator.ts` with `generateReport(incident: Incident, result: InvestigationResult): IncidentReport`
- [x] 9.2 Implement all 6 report sections: executive summary, timeline, evidence table, root cause analysis, remediation checklist, follow-up items
- [x] 9.3 Write unit tests in `tests/lib/reportGenerator.test.ts` covering all sections and formatting

## Task 10: API Routes

Implement the four Next.js API route handlers. Depends on Task 3, Task 5, Task 6, Task 7, Task 8, Task 9.

- [x] 10.1 Create `app/api/incidents/route.ts` — POST: validate body, create incident, store in-memory, return ApiResponse
- [x] 10.2 Create `app/api/incidents/[id]/route.ts` — GET: look up incident by id, return 404 if not found
- [x] 10.3 Create `app/api/incidents/[id]/investigate/route.ts` — POST: run full investigation pipeline, return InvestigationResult
- [x] 10.4 Create `app/api/incidents/[id]/report/route.ts` — GET: generate and return markdown report
- [x] 10.5 Write integration tests in `tests/api/` for all four routes

## Task 11: UI Components

Build all React UI components. Depends on Task 10.

- [x] 11.1 Create `components/IncidentSelector.tsx` — demo incident card and new incident form
- [x] 11.2 Create `components/QueryPanel.tsx` — investigation query cards with SPL code blocks and risk badges
- [x] 11.3 Create `components/EvidenceTimeline.tsx` — vertical timeline with type icons and severity colors
- [x] 11.4 Create `components/RootCauseCard.tsx` — hypothesis card with confidence bar and evidence count
- [x] 11.5 Create `components/RemediationChecklist.tsx` — ordered steps with risk badges and high-risk acknowledgment
- [x] 11.6 Create `components/ReportPreview.tsx` — markdown preview with download button
- [x] 11.7 Create `app/page.tsx` — main page orchestrating the full investigation flow with tabs
- [x] 11.8 Add loading skeleton states and error boundary with retry button

## Task 12: Security Hardening

Audit and enforce all security requirements. Depends on Task 10.

- [x] 12.1 Verify SPLUNK_TOKEN never appears in client-side bundle
- [x] 12.2 Add maskSensitiveFields call in investigate API route before returning evidence
- [x] 12.3 Add input validation for all API route parameters
- [x] 12.4 Add MAX_TIME_WINDOW_HOURS=24 cap enforced in Splunk client
- [x] 12.5 Add ALLOW_LIVE_SPL guard in investigate route
- [x] 12.6 Add security section to README.md
- [x] 12.7 Write injection-pattern tests in queryBuilder.test.ts covering 10 attack patterns

## Task 13: Hackathon Polish

Final polish, documentation, and demo preparation. Depends on Task 11 and Task 12.

- [x] 13.1 Write complete README.md with setup, env vars, demo walkthrough, architecture, and security notes
- [x] 13.2 Create `docs/architecture.md` with text-based architecture diagram
- [x] 13.3 Create `docs/demo-script.md` with 5-minute demo walkthrough script
- [x] 13.4 Create `docs/sample-report.md` with pre-generated sample post-incident report
- [x] 13.5 Verify `npm run build` completes without TypeScript errors
- [x] 13.6 Verify `npm test` passes all tests
