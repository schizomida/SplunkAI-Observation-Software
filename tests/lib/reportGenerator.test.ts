import { generateReport } from '@/lib/reporting/reportGenerator';
import { loadDemoIncident, loadDemoEvidence } from '@/lib/analysis/demoLoader';
import { analyzeRootCause } from '@/lib/analysis/rootCauseAnalyzer';
import { generateRemediation } from '@/lib/analysis/remediationEngine';
import { generateQueries } from '@/lib/analysis/queryGenerator';
import { IncidentReportSchema } from '@/lib/shared/validation';
import type { Incident, InvestigationResult } from '@/lib/types';

// ── Test Setup ────────────────────────────────────────────────────────────────

let incident: Incident;
let result: InvestigationResult;

beforeAll(() => {
  incident = loadDemoIncident();
  const evidence = loadDemoEvidence();
  const hypotheses = analyzeRootCause(evidence);
  const remediation = generateRemediation(hypotheses);
  const queries = generateQueries(incident);

  result = {
    incidentId: incident.id,
    queries,
    evidence,
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
    // The demo data should produce at least one hypothesis type
    for (const hypothesis of result.hypotheses) {
      expect(rca!.content).toContain(hypothesis.type);
    }
  });

  it('Remediation Checklist section mentions step actions', () => {
    const report = generateReport(incident, result);
    const checklist = report.sections.find((s) => s.title === 'Remediation Checklist');
    expect(checklist).toBeDefined();
    // Should mention at least the first remediation step action
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
    // Should be a valid ISO 8601 datetime
    const date = new Date(report.generatedAt);
    expect(date.toISOString()).toBe(report.generatedAt);
  });

  it('report has a non-empty id', () => {
    const report = generateReport(incident, result);
    expect(report.id).toBeDefined();
    expect(report.id.length).toBeGreaterThan(0);
  });
});
