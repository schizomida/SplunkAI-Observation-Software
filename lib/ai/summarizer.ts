import type {
  Incident,
  InvestigationResult,
  EvidenceItem,
  RootCauseHypothesis,
  RemediationStep,
} from '@/lib/types';

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

  return `Investigation of "${incident.title}" collected ${evidence.length} evidence items across ${types.length} source types (${types.join(', ')}). ${
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
  return `The most likely root cause is "${top.type}" with ${pct}% confidence. ${top.description} This conclusion is supported by ${top.supportingEvidence.length} pieces of evidence.`;
}

function fallbackRemediationSummary(
  steps: RemediationStep[],
  hypotheses: RootCauseHypothesis[]
): string {
  const approvalCount = steps.filter((s) => s.requiresApproval).length;
  const highRisk = steps.filter((s) => s.riskLevel === 'high').length;
  return `${steps.length} remediation steps have been generated. ${approvalCount} require manual approval and ${highRisk} are high-risk operations. Follow the steps in order to resolve the incident safely.`;
}

function fallbackExecutiveSummary(
  incident: Incident,
  result: InvestigationResult
): string {
  const start = new Date(incident.startTime);
  const end = new Date(incident.endTime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const top = result.hypotheses[0];

  return `${incident.severity.toUpperCase()} severity incident on ${incident.service} lasting ${durationMin} minutes. ${
    top
      ? `Root cause analysis points to ${top.type} (${Math.round(top.confidence * 100)}% confidence).`
      : 'Root cause is still under investigation.'
  } ${result.remediation.length} remediation steps have been prepared.`;
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
  const prompt = `Summarize this incident investigation in 2-3 sentences:
- Incident: "${incident.title}" on service "${incident.service}" (${incident.severity} severity)
- Evidence collected: ${evidence.length} items (types: ${Array.from(new Set(evidence.map((e) => e.type))).join(', ')})
- Top hypothesis: ${hypotheses[0]?.type || 'none'} (${hypotheses[0] ? Math.round(hypotheses[0].confidence * 100) + '%' : 'N/A'} confidence)
- Description: ${incident.description}`;

  const aiSummary = await callOpenAI(prompt);
  return aiSummary || fallbackInvestigationSummary(incident, evidence, hypotheses);
}

export async function generateRootCauseSummary(
  hypotheses: RootCauseHypothesis[],
  evidence: EvidenceItem[]
): Promise<string> {
  if (hypotheses.length === 0) {
    return fallbackRootCauseSummary(hypotheses, evidence);
  }

  const prompt = `Explain the most likely root cause in 2-3 sentences:
- Top hypothesis: "${hypotheses[0].type}" with ${Math.round(hypotheses[0].confidence * 100)}% confidence
- Description: ${hypotheses[0].description}
- Supporting evidence count: ${hypotheses[0].supportingEvidence.length}
- Other hypotheses: ${hypotheses.slice(1).map((h) => `${h.type} (${Math.round(h.confidence * 100)}%)`).join(', ') || 'none'}`;

  const aiSummary = await callOpenAI(prompt);
  return aiSummary || fallbackRootCauseSummary(hypotheses, evidence);
}

export async function generateRemediationSummary(
  steps: RemediationStep[],
  hypotheses: RootCauseHypothesis[]
): Promise<string> {
  if (steps.length === 0) {
    return 'No remediation steps were generated.';
  }

  const prompt = `Summarize this remediation plan in 2-3 sentences:
- ${steps.length} total steps
- ${steps.filter((s) => s.requiresApproval).length} require approval
- Risk levels: ${steps.filter((s) => s.riskLevel === 'high').length} high, ${steps.filter((s) => s.riskLevel === 'medium').length} medium, ${steps.filter((s) => s.riskLevel === 'low').length} low
- Top root cause: ${hypotheses[0]?.type || 'unknown'}
- Key actions: ${steps.slice(0, 3).map((s) => s.action).join('; ')}`;

  const aiSummary = await callOpenAI(prompt);
  return aiSummary || fallbackRemediationSummary(steps, hypotheses);
}

export async function generateExecutiveSummary(
  incident: Incident,
  result: InvestigationResult
): Promise<string> {
  const start = new Date(incident.startTime);
  const end = new Date(incident.endTime);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  const prompt = `Write a concise executive summary (2-3 sentences) for this incident:
- Title: "${incident.title}"
- Service: ${incident.service}, Severity: ${incident.severity}
- Duration: ${durationMin} minutes
- Evidence items: ${result.evidence.length}
- Root cause: ${result.hypotheses[0]?.type || 'unknown'} (${result.hypotheses[0] ? Math.round(result.hypotheses[0].confidence * 100) + '%' : 'N/A'})
- Remediation steps: ${result.remediation.length}
- Description: ${incident.description}`;

  const aiSummary = await callOpenAI(prompt);
  return aiSummary || fallbackExecutiveSummary(incident, result);
}
