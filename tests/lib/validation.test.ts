import {
  SeveritySchema,
  IncidentModeSchema,
  IncidentSchema,
  InvestigationQuerySchema,
  EvidenceItemSchema,
  RootCauseHypothesisSchema,
  RemediationStepSchema,
  InvestigationResultSchema,
  IncidentReportSchema,
  ApiResponseSchema,
} from '@/lib/shared/validation';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the ZodError for an invalid parse, or throws if it unexpectedly succeeds. */
function parseError(schema: z.ZodTypeAny, value: unknown): z.ZodError {
  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error(`Expected parse to fail but it succeeded for value: ${JSON.stringify(value)}`);
  }
  return result.error;
}

// ---------------------------------------------------------------------------
// SeveritySchema
// ---------------------------------------------------------------------------

describe('SeveritySchema', () => {
  const valid = ['low', 'medium', 'high', 'critical'] as const;

  test.each(valid)('accepts valid severity "%s"', (value) => {
    expect(SeveritySchema.safeParse(value).success).toBe(true);
  });

  test.each(['Low', 'MEDIUM', 'warning', 'info', '', 0, null, undefined])(
    'rejects invalid severity %p',
    (value) => {
      expect(SeveritySchema.safeParse(value).success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// IncidentModeSchema
// ---------------------------------------------------------------------------

describe('IncidentModeSchema', () => {
  test('accepts "demo"', () => {
    expect(IncidentModeSchema.safeParse('demo').success).toBe(true);
  });

  test('accepts "live"', () => {
    expect(IncidentModeSchema.safeParse('live').success).toBe(true);
  });

  test.each(['Demo', 'LIVE', 'test', '', null, undefined, 1])(
    'rejects invalid mode %p',
    (value) => {
      expect(IncidentModeSchema.safeParse(value).success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// IncidentSchema
// ---------------------------------------------------------------------------

const validIncident = {
  id: 'inc-001',
  title: 'Checkout latency spike',
  service: 'checkout-service',
  severity: 'high',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:30:00Z',
  mode: 'demo',
  description: 'P99 latency exceeded 5 s for 30 minutes.',
};

describe('IncidentSchema', () => {
  test('accepts a fully valid incident', () => {
    expect(IncidentSchema.safeParse(validIncident).success).toBe(true);
  });

  test('accepts an empty description string', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, description: '' }).success).toBe(true);
  });

  test('accepts offset-aware ISO timestamps', () => {
    const result = IncidentSchema.safeParse({
      ...validIncident,
      startTime: '2024-01-15T10:00:00+05:30',
      endTime: '2024-01-15T10:30:00-08:00',
    });
    expect(result.success).toBe(true);
  });

  // Missing required fields
  test.each(['id', 'title', 'service', 'severity', 'startTime', 'endTime', 'mode', 'description'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validIncident]: _omitted, ...rest } = validIncident;
      expect(IncidentSchema.safeParse(rest).success).toBe(false);
    }
  );

  test('rejects empty id', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, id: '' }).success).toBe(false);
  });

  test('rejects empty title', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, title: '' }).success).toBe(false);
  });

  test('rejects empty service', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, service: '' }).success).toBe(false);
  });

  test('rejects invalid severity', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, severity: 'urgent' }).success).toBe(false);
  });

  test('rejects invalid mode', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, mode: 'offline' }).success).toBe(false);
  });

  test('rejects non-ISO startTime', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, startTime: 'not-a-date' }).success).toBe(false);
  });

  test('rejects non-ISO endTime', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, endTime: '15/01/2024' }).success).toBe(false);
  });

  test('rejects numeric id', () => {
    expect(IncidentSchema.safeParse({ ...validIncident, id: 123 }).success).toBe(false);
  });

  test('rejects null object', () => {
    expect(IncidentSchema.safeParse(null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// InvestigationQuerySchema
// ---------------------------------------------------------------------------

const validQuery = {
  id: 'q-001',
  name: 'Error Rate Spike',
  description: 'Counts errors per minute.',
  spl: 'index=main sourcetype=app_logs level=ERROR | timechart count by service',
  riskLevel: 'low',
};

describe('InvestigationQuerySchema', () => {
  test('accepts a fully valid query', () => {
    expect(InvestigationQuerySchema.safeParse(validQuery).success).toBe(true);
  });

  test('accepts empty description', () => {
    expect(InvestigationQuerySchema.safeParse({ ...validQuery, description: '' }).success).toBe(true);
  });

  test.each(['id', 'name', 'spl', 'riskLevel'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validQuery]: _omitted, ...rest } = validQuery;
      expect(InvestigationQuerySchema.safeParse(rest).success).toBe(false);
    }
  );

  test('rejects empty id', () => {
    expect(InvestigationQuerySchema.safeParse({ ...validQuery, id: '' }).success).toBe(false);
  });

  test('rejects empty name', () => {
    expect(InvestigationQuerySchema.safeParse({ ...validQuery, name: '' }).success).toBe(false);
  });

  test('rejects empty spl', () => {
    expect(InvestigationQuerySchema.safeParse({ ...validQuery, spl: '' }).success).toBe(false);
  });

  test('rejects invalid riskLevel', () => {
    expect(InvestigationQuerySchema.safeParse({ ...validQuery, riskLevel: 'extreme' }).success).toBe(false);
  });

  test.each(['low', 'medium', 'high', 'critical'])('accepts riskLevel "%s"', (level) => {
    expect(InvestigationQuerySchema.safeParse({ ...validQuery, riskLevel: level }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EvidenceItemSchema
// ---------------------------------------------------------------------------

const validEvidence = {
  id: 'ev-001',
  type: 'log',
  timestamp: '2024-01-15T10:05:00Z',
  source: 'checkout-service',
  data: { message: 'Redis timeout', level: 'ERROR' },
  summary: 'Redis connection timed out after 5000 ms',
};

describe('EvidenceItemSchema', () => {
  test('accepts a fully valid evidence item', () => {
    expect(EvidenceItemSchema.safeParse(validEvidence).success).toBe(true);
  });

  test.each(['log', 'metric', 'trace', 'deployment'])('accepts type "%s"', (type) => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, type }).success).toBe(true);
  });

  test('accepts null as data (unknown type)', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, data: null }).success).toBe(true);
  });

  test('accepts array as data', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, data: [1, 2, 3] }).success).toBe(true);
  });

  test('accepts empty summary', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, summary: '' }).success).toBe(true);
  });

  test.each(['id', 'type', 'timestamp', 'source', 'summary'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validEvidence]: _omitted, ...rest } = validEvidence;
      expect(EvidenceItemSchema.safeParse(rest).success).toBe(false);
    }
  );

  test('rejects invalid type', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, type: 'event' }).success).toBe(false);
  });

  test('rejects empty id', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, id: '' }).success).toBe(false);
  });

  test('rejects empty source', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, source: '' }).success).toBe(false);
  });

  test('rejects non-ISO timestamp', () => {
    expect(EvidenceItemSchema.safeParse({ ...validEvidence, timestamp: 'yesterday' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RootCauseHypothesisSchema
// ---------------------------------------------------------------------------

const validHypothesis = {
  id: 'hyp-001',
  type: 'deployment-correlation',
  description: 'A recent deployment introduced a regression.',
  confidence: 0.85,
  supportingEvidence: ['ev-001', 'ev-002'],
  recommendedActions: ['Roll back payment-service to v1.2.3'],
};

describe('RootCauseHypothesisSchema', () => {
  test('accepts a fully valid hypothesis', () => {
    expect(RootCauseHypothesisSchema.safeParse(validHypothesis).success).toBe(true);
  });

  test('accepts confidence of exactly 0', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: 0 }).success).toBe(true);
  });

  test('accepts confidence of exactly 1', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: 1 }).success).toBe(true);
  });

  test('accepts empty supportingEvidence array', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, supportingEvidence: [] }).success).toBe(true);
  });

  test('accepts empty recommendedActions array', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, recommendedActions: [] }).success).toBe(true);
  });

  test('accepts empty description', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, description: '' }).success).toBe(true);
  });

  test('rejects confidence below 0', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: -0.01 }).success).toBe(false);
  });

  test('rejects confidence above 1', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: 1.01 }).success).toBe(false);
  });

  test('rejects confidence of -1', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: -1 }).success).toBe(false);
  });

  test('rejects confidence of 2', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: 2 }).success).toBe(false);
  });

  test('rejects string confidence', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, confidence: '0.5' }).success).toBe(false);
  });

  test('rejects empty id', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, id: '' }).success).toBe(false);
  });

  test('rejects empty type', () => {
    expect(RootCauseHypothesisSchema.safeParse({ ...validHypothesis, type: '' }).success).toBe(false);
  });

  test.each(['id', 'type', 'confidence', 'supportingEvidence', 'recommendedActions'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validHypothesis]: _omitted, ...rest } = validHypothesis;
      expect(RootCauseHypothesisSchema.safeParse(rest).success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// RemediationStepSchema
// ---------------------------------------------------------------------------

const validStep = {
  id: 'step-001',
  order: 1,
  action: 'Roll back payment-service',
  description: 'Revert to the last known good version.',
  riskLevel: 'high',
  requiresApproval: true,
  estimatedTime: '10 minutes',
};

describe('RemediationStepSchema', () => {
  test('accepts a fully valid remediation step', () => {
    expect(RemediationStepSchema.safeParse(validStep).success).toBe(true);
  });

  test.each(['low', 'medium', 'high'])('accepts riskLevel "%s"', (level) => {
    expect(RemediationStepSchema.safeParse({ ...validStep, riskLevel: level }).success).toBe(true);
  });

  test('accepts requiresApproval = false', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, requiresApproval: false }).success).toBe(true);
  });

  test('accepts order = 1 (minimum)', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, order: 1 }).success).toBe(true);
  });

  test('accepts large order values', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, order: 999 }).success).toBe(true);
  });

  test('accepts empty description', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, description: '' }).success).toBe(true);
  });

  test('rejects order = 0', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, order: 0 }).success).toBe(false);
  });

  test('rejects negative order', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, order: -1 }).success).toBe(false);
  });

  test('rejects fractional order', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, order: 1.5 }).success).toBe(false);
  });

  test('rejects invalid riskLevel "critical"', () => {
    // RemediationStep only allows low/medium/high, not critical
    expect(RemediationStepSchema.safeParse({ ...validStep, riskLevel: 'critical' }).success).toBe(false);
  });

  test('rejects invalid riskLevel "extreme"', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, riskLevel: 'extreme' }).success).toBe(false);
  });

  test('rejects empty id', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, id: '' }).success).toBe(false);
  });

  test('rejects empty action', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, action: '' }).success).toBe(false);
  });

  test('rejects empty estimatedTime', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, estimatedTime: '' }).success).toBe(false);
  });

  test('rejects string requiresApproval', () => {
    expect(RemediationStepSchema.safeParse({ ...validStep, requiresApproval: 'yes' }).success).toBe(false);
  });

  test.each(['id', 'order', 'action', 'riskLevel', 'requiresApproval', 'estimatedTime'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validStep]: _omitted, ...rest } = validStep;
      expect(RemediationStepSchema.safeParse(rest).success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// InvestigationResultSchema
// ---------------------------------------------------------------------------

const validResult = {
  incidentId: 'inc-001',
  queries: [validQuery],
  evidence: [validEvidence],
  hypotheses: [validHypothesis],
  remediation: [validStep],
  analyzedAt: '2024-01-15T10:35:00Z',
};

describe('InvestigationResultSchema', () => {
  test('accepts a fully valid investigation result', () => {
    expect(InvestigationResultSchema.safeParse(validResult).success).toBe(true);
  });

  test('accepts empty arrays for queries, evidence, hypotheses, remediation', () => {
    expect(
      InvestigationResultSchema.safeParse({
        ...validResult,
        queries: [],
        evidence: [],
        hypotheses: [],
        remediation: [],
      }).success
    ).toBe(true);
  });

  test('rejects empty incidentId', () => {
    expect(InvestigationResultSchema.safeParse({ ...validResult, incidentId: '' }).success).toBe(false);
  });

  test('rejects non-ISO analyzedAt', () => {
    expect(InvestigationResultSchema.safeParse({ ...validResult, analyzedAt: 'now' }).success).toBe(false);
  });

  test('rejects invalid nested query', () => {
    expect(
      InvestigationResultSchema.safeParse({
        ...validResult,
        queries: [{ ...validQuery, riskLevel: 'extreme' }],
      }).success
    ).toBe(false);
  });

  test('rejects invalid nested evidence', () => {
    expect(
      InvestigationResultSchema.safeParse({
        ...validResult,
        evidence: [{ ...validEvidence, type: 'unknown' }],
      }).success
    ).toBe(false);
  });

  test('rejects invalid nested hypothesis (confidence out of range)', () => {
    expect(
      InvestigationResultSchema.safeParse({
        ...validResult,
        hypotheses: [{ ...validHypothesis, confidence: 1.5 }],
      }).success
    ).toBe(false);
  });

  test('rejects invalid nested remediation step (order = 0)', () => {
    expect(
      InvestigationResultSchema.safeParse({
        ...validResult,
        remediation: [{ ...validStep, order: 0 }],
      }).success
    ).toBe(false);
  });

  test.each(['incidentId', 'queries', 'evidence', 'hypotheses', 'remediation', 'analyzedAt'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validResult]: _omitted, ...rest } = validResult;
      expect(InvestigationResultSchema.safeParse(rest).success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// IncidentReportSchema
// ---------------------------------------------------------------------------

const validReport = {
  id: 'report-001',
  incidentId: 'inc-001',
  generatedAt: '2024-01-15T11:00:00Z',
  sections: [
    { title: 'Executive Summary', content: 'The checkout service experienced elevated latency.' },
    { title: 'Timeline', content: '' },
  ],
  markdown: '# Post-Incident Report\n\n## Executive Summary\n...',
};

describe('IncidentReportSchema', () => {
  test('accepts a fully valid incident report', () => {
    expect(IncidentReportSchema.safeParse(validReport).success).toBe(true);
  });

  test('accepts empty sections array', () => {
    expect(IncidentReportSchema.safeParse({ ...validReport, sections: [] }).success).toBe(true);
  });

  test('accepts empty markdown string', () => {
    expect(IncidentReportSchema.safeParse({ ...validReport, markdown: '' }).success).toBe(true);
  });

  test('accepts section with empty content', () => {
    expect(
      IncidentReportSchema.safeParse({
        ...validReport,
        sections: [{ title: 'Empty Section', content: '' }],
      }).success
    ).toBe(true);
  });

  test('rejects section with empty title', () => {
    expect(
      IncidentReportSchema.safeParse({
        ...validReport,
        sections: [{ title: '', content: 'some content' }],
      }).success
    ).toBe(false);
  });

  test('rejects empty id', () => {
    expect(IncidentReportSchema.safeParse({ ...validReport, id: '' }).success).toBe(false);
  });

  test('rejects empty incidentId', () => {
    expect(IncidentReportSchema.safeParse({ ...validReport, incidentId: '' }).success).toBe(false);
  });

  test('rejects non-ISO generatedAt', () => {
    expect(IncidentReportSchema.safeParse({ ...validReport, generatedAt: 'today' }).success).toBe(false);
  });

  test('rejects section missing title', () => {
    expect(
      IncidentReportSchema.safeParse({
        ...validReport,
        sections: [{ content: 'no title here' }],
      }).success
    ).toBe(false);
  });

  test.each(['id', 'incidentId', 'generatedAt', 'sections', 'markdown'])(
    'rejects when required field "%s" is missing',
    (field) => {
      const { [field as keyof typeof validReport]: _omitted, ...rest } = validReport;
      expect(IncidentReportSchema.safeParse(rest).success).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// ApiResponseSchema
// ---------------------------------------------------------------------------

describe('ApiResponseSchema', () => {
  const IncidentApiResponse = ApiResponseSchema(IncidentSchema);

  test('accepts a successful response with data', () => {
    expect(
      IncidentApiResponse.safeParse({
        success: true,
        data: validIncident,
        error: null,
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(true);
  });

  test('accepts an error response with null data', () => {
    expect(
      IncidentApiResponse.safeParse({
        success: false,
        data: null,
        error: 'Incident not found',
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(true);
  });

  test('accepts null error on success', () => {
    expect(
      IncidentApiResponse.safeParse({
        success: true,
        data: validIncident,
        error: null,
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(true);
  });

  test('rejects missing success field', () => {
    expect(
      IncidentApiResponse.safeParse({
        data: validIncident,
        error: null,
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(false);
  });

  test('rejects missing timestamp', () => {
    expect(
      IncidentApiResponse.safeParse({
        success: true,
        data: validIncident,
        error: null,
      }).success
    ).toBe(false);
  });

  test('rejects non-ISO timestamp', () => {
    expect(
      IncidentApiResponse.safeParse({
        success: true,
        data: validIncident,
        error: null,
        timestamp: 'not-a-date',
      }).success
    ).toBe(false);
  });

  test('rejects invalid nested data (bad incident)', () => {
    expect(
      IncidentApiResponse.safeParse({
        success: true,
        data: { ...validIncident, severity: 'extreme' },
        error: null,
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(false);
  });

  test('works with a primitive schema (z.string())', () => {
    const StringApiResponse = ApiResponseSchema(z.string());
    expect(
      StringApiResponse.safeParse({
        success: true,
        data: 'hello',
        error: null,
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(true);
  });

  test('works with z.number() schema', () => {
    const NumberApiResponse = ApiResponseSchema(z.number());
    expect(
      NumberApiResponse.safeParse({
        success: false,
        data: null,
        error: 'Not found',
        timestamp: '2024-01-15T10:00:00Z',
      }).success
    ).toBe(true);
  });
});
