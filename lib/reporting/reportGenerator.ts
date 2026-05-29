import crypto from 'crypto';
import type { Incident, InvestigationResult, IncidentReport, EvidenceItem } from '@/lib/types';

// ── Section Generators ────────────────────────────────────────────────────────

/**
 * Generates the Executive Summary section.
 * Brief overview of the incident: service, severity, duration, and top hypothesis.
 */
function generateExecutiveSummary(incident: Incident, result: InvestigationResult): string {
  const start = new Date(incident.startTime);
  const end = new Date(incident.endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  const topHypothesis = result.hypotheses.length > 0
    ? result.hypotheses[0]
    : null;

  let summary = `**Incident:** ${incident.title}\n`;
  summary += `**Service:** ${incident.service}\n`;
  summary += `**Severity:** ${incident.severity}\n`;
  summary += `**Duration:** ${durationMinutes} minutes\n`;
  summary += `**Time Window:** ${incident.startTime} — ${incident.endTime}\n\n`;

  if (topHypothesis) {
    summary += `**Most Likely Root Cause:** ${topHypothesis.type} (confidence: ${(topHypothesis.confidence * 100).toFixed(0)}%)\n`;
    summary += `${topHypothesis.description}\n`;
  } else {
    summary += `No root cause hypotheses were generated for this incident.\n`;
  }

  return summary;
}

/**
 * Generates the Timeline section.
 * Chronological list of evidence items sorted by timestamp.
 */
function generateTimeline(result: InvestigationResult): string {
  if (result.evidence.length === 0) {
    return 'No evidence items collected.\n';
  }

  const sorted = [...result.evidence].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let timeline = '';
  for (const item of sorted) {
    timeline += `- **${item.timestamp}** [${item.type}] ${item.summary}\n`;
  }

  return timeline;
}

/**
 * Generates the Evidence Table section.
 * Formatted table of all evidence items (id, type, timestamp, source, summary).
 */
function generateEvidenceTable(result: InvestigationResult): string {
  if (result.evidence.length === 0) {
    return 'No evidence items collected.\n';
  }

  let table = '| ID | Type | Timestamp | Source | Summary |\n';
  table += '| --- | --- | --- | --- | --- |\n';

  for (const item of result.evidence) {
    table += `| ${item.id} | ${item.type} | ${item.timestamp} | ${item.source} | ${item.summary} |\n`;
  }

  return table;
}

/**
 * Generates the Root Cause Analysis section.
 * Description of each hypothesis with confidence scores.
 */
function generateRootCauseAnalysis(result: InvestigationResult): string {
  if (result.hypotheses.length === 0) {
    return 'No root cause hypotheses were generated.\n';
  }

  let content = '';
  for (const hypothesis of result.hypotheses) {
    content += `### ${hypothesis.type} (Confidence: ${(hypothesis.confidence * 100).toFixed(0)}%)\n\n`;
    content += `${hypothesis.description}\n\n`;
    content += `**Supporting Evidence:** ${hypothesis.supportingEvidence.join(', ')}\n\n`;
    content += `**Recommended Actions:**\n`;
    for (const action of hypothesis.recommendedActions) {
      content += `- ${action}\n`;
    }
    content += '\n';
  }

  return content;
}

/**
 * Generates the Remediation Checklist section.
 * Ordered list of remediation steps with risk levels and approval status.
 */
function generateRemediationChecklist(result: InvestigationResult): string {
  if (result.remediation.length === 0) {
    return 'No remediation steps generated.\n';
  }

  let content = '';
  for (const step of result.remediation) {
    const approvalTag = step.requiresApproval ? ' ⚠️ REQUIRES APPROVAL' : '';
    content += `${step.order}. **${step.action}** [Risk: ${step.riskLevel}]${approvalTag}\n`;
    content += `   ${step.description}\n`;
    content += `   _Estimated time: ${step.estimatedTime}_\n\n`;
  }

  return content;
}

/**
 * Generates the Follow-up Items section.
 * Suggested follow-up actions based on the investigation.
 */
function generateFollowUpItems(incident: Incident, result: InvestigationResult): string {
  const items: string[] = [];

  // Always suggest a post-mortem
  items.push(`Schedule post-mortem meeting for incident "${incident.title}"`);

  // Suggest monitoring improvements based on hypotheses
  if (result.hypotheses.some((h) => h.type === 'deployment-correlation')) {
    items.push('Review deployment pipeline and add pre-deployment health checks');
  }
  if (result.hypotheses.some((h) => h.type === 'dependency-timeout')) {
    items.push('Implement circuit breaker patterns for downstream dependencies');
  }
  if (result.hypotheses.some((h) => h.type === 'resource-exhaustion')) {
    items.push('Set up proactive resource utilization alerts');
  }
  if (result.hypotheses.some((h) => h.type === 'error-spike')) {
    items.push('Improve error handling and add error budget monitoring');
  }

  // General follow-ups
  items.push('Update runbooks with findings from this investigation');
  items.push('Review and update alerting thresholds based on incident timeline');

  let content = '';
  for (const item of items) {
    content += `- [ ] ${item}\n`;
  }

  return content;
}

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Generates a complete post-incident report from an incident and investigation result.
 *
 * The report includes 6 sections:
 * 1. Executive Summary
 * 2. Timeline
 * 3. Evidence Table
 * 4. Root Cause Analysis
 * 5. Remediation Checklist
 * 6. Follow-up Items
 *
 * Also generates a combined markdown document.
 */
export function generateReport(incident: Incident, result: InvestigationResult): IncidentReport {
  const sections = [
    { title: 'Executive Summary', content: generateExecutiveSummary(incident, result) },
    { title: 'Timeline', content: generateTimeline(result) },
    { title: 'Evidence Table', content: generateEvidenceTable(result) },
    { title: 'Root Cause Analysis', content: generateRootCauseAnalysis(result) },
    { title: 'Remediation Checklist', content: generateRemediationChecklist(result) },
    { title: 'Follow-up Items', content: generateFollowUpItems(incident, result) },
  ];

  // Build combined markdown
  let markdown = `# Incident Report: ${incident.title}\n\n`;
  markdown += `**Report Generated:** ${new Date().toISOString()}\n\n`;
  markdown += `---\n\n`;

  for (const section of sections) {
    markdown += `## ${section.title}\n\n`;
    markdown += `${section.content}\n`;
    markdown += `---\n\n`;
  }

  return {
    id: crypto.randomUUID(),
    incidentId: incident.id,
    generatedAt: new Date().toISOString(),
    sections,
    markdown,
  };
}
