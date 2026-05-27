import { z } from 'zod';

/**
 * Schema for Severity — the four incident/risk severity levels.
 */
export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Schema for IncidentMode — demo uses synthetic fixtures, live connects to Splunk.
 */
export const IncidentModeSchema = z.enum(['demo', 'live']);
export type IncidentMode = z.infer<typeof IncidentModeSchema>;

/**
 * Schema for Incident — a production incident under investigation.
 */
export const IncidentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  service: z.string().min(1),
  severity: SeveritySchema,
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  mode: IncidentModeSchema,
  description: z.string(),
});
export type Incident = z.infer<typeof IncidentSchema>;

/**
 * Schema for InvestigationQuery — a generated SPL query with metadata.
 */
export const InvestigationQuerySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  spl: z.string().min(1),
  riskLevel: SeveritySchema,
});
export type InvestigationQuery = z.infer<typeof InvestigationQuerySchema>;

/**
 * Schema for EvidenceItem — a single piece of observability evidence.
 */
export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['log', 'metric', 'trace', 'deployment']),
  timestamp: z.string().datetime({ offset: true }),
  source: z.string().min(1),
  data: z.unknown(),
  summary: z.string(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/**
 * Schema for RootCauseHypothesis — a ranked hypothesis about the root cause.
 */
export const RootCauseHypothesisSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  supportingEvidence: z.array(z.string()),
  recommendedActions: z.array(z.string()),
});
export type RootCauseHypothesis = z.infer<typeof RootCauseHypothesisSchema>;

/**
 * Schema for RemediationStep — a single step in a remediation playbook.
 */
export const RemediationStepSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1),
  action: z.string().min(1),
  description: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  requiresApproval: z.boolean(),
  estimatedTime: z.string().min(1),
});
export type RemediationStep = z.infer<typeof RemediationStepSchema>;

/**
 * Schema for InvestigationResult — the full output of an investigation pipeline run.
 */
export const InvestigationResultSchema = z.object({
  incidentId: z.string().min(1),
  queries: z.array(InvestigationQuerySchema),
  evidence: z.array(EvidenceItemSchema),
  hypotheses: z.array(RootCauseHypothesisSchema),
  remediation: z.array(RemediationStepSchema),
  analyzedAt: z.string().datetime({ offset: true }),
});
export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;

/**
 * Schema for IncidentReport — a generated post-incident report.
 */
export const IncidentReportSchema = z.object({
  id: z.string().min(1),
  incidentId: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  sections: z.array(
    z.object({
      title: z.string().min(1),
      content: z.string(),
    })
  ),
  markdown: z.string(),
});
export type IncidentReport = z.infer<typeof IncidentReportSchema>;

/**
 * Schema factory for ApiResponse<T> — the generic API response envelope.
 * Pass the data schema as an argument: ApiResponseSchema(IncidentSchema)
 */
export function ApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    timestamp: z.string().datetime({ offset: true }),
  });
}
export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
};
