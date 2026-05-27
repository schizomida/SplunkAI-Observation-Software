/**
 * Severity levels for incidents and risk assessments.
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Operational mode — 'demo' uses synthetic fixtures, 'live' connects to Splunk.
 */
export type IncidentMode = 'demo' | 'live';

/**
 * Represents a production incident under investigation.
 */
export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  mode: IncidentMode;
  description: string;
}

/**
 * A generated SPL investigation query with metadata.
 */
export interface InvestigationQuery {
  id: string;
  name: string;
  description: string;
  spl: string;
  riskLevel: Severity;
}

/**
 * A single piece of observability evidence collected during investigation.
 */
export interface EvidenceItem {
  id: string;
  type: 'log' | 'metric' | 'trace' | 'deployment';
  timestamp: string; // ISO 8601
  source: string;
  data: unknown;
  summary: string;
}

/**
 * A ranked hypothesis about the root cause of an incident.
 */
export interface RootCauseHypothesis {
  id: string;
  type: string;
  description: string;
  /** Confidence score between 0 (no confidence) and 1 (certain). */
  confidence: number;
  supportingEvidence: string[];
  recommendedActions: string[];
}

/**
 * A single step in a remediation playbook.
 */
export interface RemediationStep {
  id: string;
  order: number;
  action: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  estimatedTime: string;
}

/**
 * The full output of an investigation pipeline run for an incident.
 */
export interface InvestigationResult {
  incidentId: string;
  queries: InvestigationQuery[];
  evidence: EvidenceItem[];
  hypotheses: RootCauseHypothesis[];
  remediation: RemediationStep[];
  analyzedAt: string; // ISO 8601
}

/**
 * A generated post-incident report with structured sections and markdown output.
 */
export interface IncidentReport {
  id: string;
  incidentId: string;
  generatedAt: string; // ISO 8601
  sections: Array<{
    title: string;
    content: string;
  }>;
  markdown: string;
}

/**
 * Generic API response envelope used by all API routes.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string; // ISO 8601
}
