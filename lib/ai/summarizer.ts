import type {
  Incident,
  InvestigationResult,
  EvidenceItem,
  RootCauseHypothesis,
  RemediationStep,
} from '@/lib/types';
import { summarizeWithSplunkAI } from '@/lib/ai/splunkAssistant';

// ── Fallback Summaries (rule-based, no API key needed) ────────────────────────

function fallbackInvestigationSummary(
  incident: Incident,
  evidence: EvidenceItem[],
  hypotheses: RootCauseHypothesis[]
): string {
  const types = Array.from(new Set(evidence.map((e) => e.type)));
  const topHypothesis = hypotheses[0];
  const confidence = topHypothesis
    ? `${Math.round(topHypothesis.confidence * 100)}%`
    : 'N/A';

  // Count errors
  const errorCount = evidence.filter((e) => {
    const data = e.data as Record<string, unknown> | null;
    return data && typeof data === 'object' && 'level' in data && (data.level === 'ERROR' || data.level === 'error');
  }).length;

  // Get unique services
  const services = Array.from(new Set(evidence.map((e) => e.source)));

  // Find earliest timestamp
  const timestamps = evidence.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  const earliestAnomaly = timestamps.length > 0 ? new Date(timestamps[0]).toLocaleTimeString() : 'unknown';

  // Primary signal source
  const sourceCounts: Record<string, number> = {};
  for (const e of evidence) {
    sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
  }
  const primarySource = Object.entries(sourceCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

  return `Investigation of "${incident.title}" detected ${errorCount > 0 ? `${errorCount} error events` : `${evidence.length} evidence items`} across ${services.length} service${services.length !== 1 ? 's' : ''}, with the earliest anomaly at ${earliestAnomaly}. The primary signal comes from ${primarySource} where ${types.join('/')} patterns were observed. ${
    topHypothesis
      ? `The leading hypothesis points to ${topHypothesis.type} with ${confidence} confidence.`
      : 'No root cause hypotheses were generated.'
  }`;
}

function fallbackRootCauseSummary(
  hypotheses: RootCauseHypothesis[],
  evidence: EvidenceItem[]
): string {
  if (hypotheses.length === 0) {
    return 'No root cause hypotheses were generated from the available evidence.';
  }
  const top = hypotheses[0];
  const pct = Math.round(top.confidence * 100);

  // Identify specific patterns from supporting evidence
  const supportingItems = evidence.filter((e) => top.supportingEvidence.includes(e.id));
  const evidenceTypes = Array.from(new Set(supportingItems.map((e) => e.type)));
  const patternDesc = evidenceTypes.length > 0 ? evidenceTypes.join(', ') + ' anomalies' : 'correlated signals';

  // First recommended action
  const firstAction = top.recommendedActions[0] || 'investigate further';

  return `The ${top.type} hypothesis suggests that ${top.description} This is supported by ${top.supportingEvidence.length} evidence item${top.supportingEvidence.length !== 1 ? 's' : ''} showing ${patternDesc}. Recommended immediate action: ${firstAction}.`;
}

function fallbackRemediationSummary(
  steps: RemediationStep[],
  hypotheses: RootCauseHypothesis[]
): string {
  const approvalCount = steps.filter((s) => s.requiresApproval).length;
  const highRisk = steps.filter((s) => s.riskLevel === 'high').length;

  // Parse estimated times
  const totalMinutes = steps.reduce((acc, step) => {
    const match = step.estimatedTime.match(/(\d+)/);
    return acc + (match ? parseInt(match[1], 10) : 5);
  }, 0);

  // First and second actions
  const firstAction = steps[0]?.action || 'initial step';
  const secondAction = steps[1]?.action || 'follow-up';

  // High-risk steps summary
  const highRiskSteps = steps.filter((s) => s.riskLevel === 'high').map((s) => s.action);
  const criticalPath = highRiskSteps.length > 0 ? highRiskSteps.join(', ') : 'none identified';

  return `Start with "${firstAction}" (~${steps[0]?.estimatedTime || '5 min'}), then proceed to "${secondAction}". Critical path: ${criticalPath}. Total estimated time: ~${totalMinutes} min. ${approvalCount} step${approvalCount !== 1 ? 's' : ''} require${approvalCount === 1 ? 's' : ''} approval and ${highRisk} ${highRisk === 1 ? 'is' : 'are'} high-risk.`;
}

function fallbackExecutiveSummary(
  incident: Incident,
  result: InvestigationResult
): string {
  const start = new Date(incident.startTime);
  const end = new Date(incident.endTime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const top = result.hypotheses[0];

  // Count affected services
  const affectedServices = Array.from(new Set(result.evidence.map((e) => e.source)));
  const approvalNeeded = result.remediation.filter((s) => s.requiresApproval).length;

  return `A ${incident.severity.toUpperCase()} incident on ${incident.service} lasting ${durationMin} minutes impacted ${affectedServices.length} service${affectedServices.length !== 1 ? 's' : ''}. ${
    top
      ? `Root cause analysis identifies ${top.type} as the primary factor (${Math.round(top.confidence * 100)}% confidence).`
      : 'Root cause is still under investigation.'
  } ${result.remediation.length} remediation steps are ready, with ${approvalNeeded} requiring approval.`;
}

// ── OpenAI-Powered Summaries ──────────────────────────────────────────────────

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert SRE assistant. Generate concise, actionable summaries for incident investigations. Keep responses to 2-3 sentences maximum. Be specific and technical.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// ── Exported Functions ────────────────────────────────────────────────────────

export async function generateInvestigationSummary(
  incident: Incident,
  evidence: EvidenceItem[],
  hypotheses: RootCauseHypothesis[]
): Promise<string> {
  // Priority 1: Splunk AI Assistant
  const splunkSummary = await summarizeWithSplunkAI({
    type: 'investigation',
    incident,
    evidence,
    hypotheses,
  });
  if (splunkSummary) return splunkSummary;

  // Priority 2: OpenAI
  const prompt = `Summarize this incident investigation in 2-3 sentences:
- Incident: "${incident.title}" on service "${incident.service}" (${incident.severity} severity)
- Evidence collected: ${evidence.length} items (types: ${Array.from(new Set(evidence.map((e) => e.type))).join(', ')})
- Top hypothesis: ${hypotheses[0]?.type || 'none'} (${hypotheses[0] ? Math.round(hypotheses[0].confidence * 100) + '%' : 'N/A'} confidence)
- Description: ${incident.description}`;

  const aiSummary = await callOpenAI(prompt);
  if (aiSummary) return aiSummary;

  // Priority 3: Rule-based fallback
  return fallbackInvestigationSummary(incident, evidence, hypotheses);
}

export async function generateRootCauseSummary(
  hypotheses: RootCauseHypothesis[],
  evidence: EvidenceItem[]
): Promise<string> {
  if (hypotheses.length === 0) {
    return fallbackRootCauseSummary(hypotheses, evidence);
  }

  // Priority 1: Splunk AI Assistant
  const splunkSummary = await summarizeWithSplunkAI({
    type: 'rootcause',
    hypotheses,
    evidence,
  });
  if (splunkSummary) return splunkSummary;

  // Priority 2: OpenAI
  const prompt = `Explain the most likely root cause in 2-3 sentences:
- Top hypothesis: "${hypotheses[0].type}" with ${Math.round(hypotheses[0].confidence * 100)}% confidence
- Description: ${hypotheses[0].description}
- Supporting evidence count: ${hypotheses[0].supportingEvidence.length}
- Other hypotheses: ${hypotheses.slice(1).map((h) => `${h.type} (${Math.round(h.confidence * 100)}%)`).join(', ') || 'none'}`;

  const aiSummary = await callOpenAI(prompt);
  if (aiSummary) return aiSummary;

  // Priority 3: Rule-based fallback
  return fallbackRootCauseSummary(hypotheses, evidence);
}

export async function generateRemediationSummary(
  steps: RemediationStep[],
  hypotheses: RootCauseHypothesis[]
): Promise<string> {
  if (steps.length === 0) {
    return 'No remediation steps were generated.';
  }

  // Priority 1: Splunk AI Assistant
  const splunkSummary = await summarizeWithSplunkAI({
    type: 'remediation',
    steps,
    hypotheses,
  });
  if (splunkSummary) return splunkSummary;

  // Priority 2: OpenAI
  const prompt = `Summarize this remediation plan in 2-3 sentences:
- ${steps.length} total steps
- ${steps.filter((s) => s.requiresApproval).length} require approval
- Risk levels: ${steps.filter((s) => s.riskLevel === 'high').length} high, ${steps.filter((s) => s.riskLevel === 'medium').length} medium, ${steps.filter((s) => s.riskLevel === 'low').length} low
- Top root cause: ${hypotheses[0]?.type || 'unknown'}
- Key actions: ${steps.slice(0, 3).map((s) => s.action).join('; ')}`;

  const aiSummary = await callOpenAI(prompt);
  if (aiSummary) return aiSummary;

  // Priority 3: Rule-based fallback
  return fallbackRemediationSummary(steps, hypotheses);
}

export async function generateExecutiveSummary(
  incident: Incident,
  result: InvestigationResult
): Promise<string> {
  const start = new Date(incident.startTime);
  const end = new Date(incident.endTime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  // Priority 1: Splunk AI Assistant
  const splunkSummary = await summarizeWithSplunkAI({
    type: 'executive',
    incident,
    result,
  });
  if (splunkSummary) return splunkSummary;

  // Priority 2: OpenAI
  const prompt = `Write a concise executive summary (2-3 sentences) for this incident:
- Title: "${incident.title}"
- Service: ${incident.service}, Severity: ${incident.severity}
- Duration: ${durationMin} minutes
- Evidence items: ${result.evidence.length}
- Root cause: ${result.hypotheses[0]?.type || 'unknown'} (${result.hypotheses[0] ? Math.round(result.hypotheses[0].confidence * 100) + '%' : 'N/A'})
- Remediation steps: ${result.remediation.length}
- Description: ${incident.description}`;

  const aiSummary = await callOpenAI(prompt);
  if (aiSummary) return aiSummary;

  // Priority 3: Rule-based fallback
  return fallbackExecutiveSummary(incident, result);
}
