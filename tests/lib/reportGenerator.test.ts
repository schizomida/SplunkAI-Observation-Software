import { generateReport } from '@/lib/reporting/reportGenerator';
import { analyzeRootCause } from '@/lib/analysis/rootCauseAnalyzer';
import { generateRemediation } from '@/lib/analysis/remediationEngine';
import { generateQueries } from '@/lib/analysis/queryGenerator';
import { IncidentReportSchema } from '@/lib/shared/validation';
import type { Incident, InvestigationResult, EvidenceItem } from '@/lib/types';

// ── Test Setup ────────────────────────────────────────────────────────────────

const testIncident: Incident = {
  id: 'test-001',
  title: 'Checkout Service Latency Spike',
  service: 'checkout-service',
  severity: 'high',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:30:00Z',
  mode: 'live',
  description: 'P99 checkout latency spiked from 120ms to over 4,200ms.',
};

const testEvidence: EvidenceItem[] = [
  {
    id: 'log-1',
    type: 'log',
    timestamp: '2024-01-15T10:05:00Z',
    source: 'checkout-service',
    data: { level: 'ERROR', message: 'Redis connection timeout' },
    summary: '[ERROR] checkout-service: Redis connection timeout after 5000ms',
  },
  {
    id: 'log-2',
    type: 'log',
    timestamp: '2024-01-15T10:06:00Z',
    source: 'payment-service',
    data: { level: 'ERROR', message: 'Retry exhaustion' },
    summary: '[ERROR] payment-service: Retry exhaustion on downstream call',
  },
  {
    id: 'metric-1',
    type: 'metric',
    timestamp: '2024-01-15T10:04:00Z',
    source: 'checkout-service',
    data: { name: 'p99_latency', value: 4200 },
    summary: 'Metric series "p99_latency" (ms) for checkout-service — 10 data points',
  },
  {
    id: 'deployment-1',
    type: 'deployment',
    timestamp: '2024-01-15T09:52:00Z',
    source: 'payment-service',
    data: { version: 'v2.4.1', previousVersion: 'v2.4.0' },
    summary: 'Deployment of payment-service v2.4.1 (prev: v2.4.0) to production by deploy-bot',
  },
  {
    id: 'trace-1',
    type: 'trace',
    timestamp: '2024-01-15T10:07:00Z',
    source: 'checkout-flow',
    data: { traceId: 'abc123', spans: 5 },
    summary: 'Trace abc123 — 5 spans, 2 error/timeout span(s) rooted at checkout-flow',
  },
];

let incident: Incident;
let result: InvestigationResult;

beforeAll(() => {
  incident = testIncident;
  const hypotheses = analyzeRootCause(testEvidence);
  const remediation = generateRemediation(hypotheses);
  const queries = generateQueries(incident);

  result = {
    incidentId: incident.id,
    queries,
    evidence: testEvidence,
    hypotheses,
    remediation,
    analyzedAt: new Date().toISOString(),
  };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateReport', () => {
  it('returns a valid IncidentReport that passes IncidentReportSchema', () => {
    const report = generateReport(incident, result);
    const parsed = IncidentReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
  });

  it('report has exactly 6 sections', () => {
    const report = generateReport(incident, result);
    expect(report.sections).toHaveLength(6);
  });

  it('all section titles match expected names', () => {
    const report = generateReport(incident, result);
    const expectedTitles = [
      'Executive Summary',
      'Timeline',
      'Evidence Table',
      'Root Cause Analysis',
      'Remediation Checklist',
      'Follow-up Items',
    ];
    const actualTitles = report.sections.map((s) => s.title);
    expect(actualTitles).toEqual(expectedTitles);
  });

  it('Executive Summary mentions the incident service and severity', () => {
    const report = generateReport(incident, result);
    const execSummary = report.sections.find((s) => s.title === 'Executive Summary');
    expect(execSummary).toBeDefined();
    expect(execSummary!.content).toContain(incident.service);
    expect(execSummary!.content).toContain(incident.severity);
  });

  it('Timeline section is non-empty when evidence exists', () => {
    const report = generateReport(incident, result);
    const timeline = report.sections.find((s) => s.title === 'Timeline');
    expect(timeline).toBeDefined();
    expect(timeline!.content.length).toBeGreaterThan(0);
    expect(timeline!.content).not.toContain('No evidence items collected');
  });

  it('Evidence Table section is non-empty when evidence exists', () => {
    const report = generateReport(incident, result);
    const evidenceTable = report.sections.find((s) => s.title === 'Evidence Table');
    expect(evidenceTable).toBeDefined();
    expect(evidenceTable!.content.length).toBeGreaterThan(0);
    expect(evidenceTable!.content).toContain('| ID |');
  });

  it('Root Cause Analysis section mentions hypothesis types', () => {
    const report = generateReport(incident, result);
    const rca = report.sections.find((s) => s.title === 'Root Cause Analysis');
    expect(rca).toBeDefined();
    for (const hypothesis of result.hypotheses) {
      expect(rca!.content).toContain(hypothesis.type);
    }
  });

  it('Remediation Checklist section mentions step actions', () => {
    const report = generateReport(incident, result);
    const checklist = report.sections.find((s) => s.title === 'Remediation Checklist');
    expect(checklist).toBeDefined();
    expect(checklist!.content).toContain(result.remediation[0].action);
  });

  it('Follow-up Items section is non-empty', () => {
    const report = generateReport(incident, result);
    const followUp = report.sections.find((s) => s.title === 'Follow-up Items');
    expect(followUp).toBeDefined();
    expect(followUp!.content.length).toBeGreaterThan(0);
    expect(followUp!.content).toContain('- [ ]');
  });

  it('Markdown field contains all section titles', () => {
    const report = generateReport(incident, result);
    const expectedTitles = [
      'Executive Summary',
      'Timeline',
      'Evidence Table',
      'Root Cause Analysis',
      'Remediation Checklist',
      'Follow-up Items',
    ];
    for (const title of expectedTitles) {
      expect(report.markdown).toContain(`## ${title}`);
    }
  });

  it('report has a valid generatedAt ISO timestamp', () => {
    const report = generateReport(incident, result);
    const date = new Date(report.generatedAt);
    expect(date.toISOString()).toBe(report.generatedAt);
  });

  it('report has a non-empty id', () => {
    const report = generateReport(incident, result);
    expect(report.id).toBeDefined();
    expect(report.id.length).toBeGreaterThan(0);
  });
});
