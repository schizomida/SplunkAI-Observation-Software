import { loadDemoIncident, loadDemoEvidence } from '@/lib/analysis/demoLoader';
import { IncidentSchema, EvidenceItemSchema } from '@/lib/shared/validation';

// ---------------------------------------------------------------------------
// loadDemoIncident
// ---------------------------------------------------------------------------

describe('loadDemoIncident', () => {
  test('returns an object that passes IncidentSchema validation', () => {
    const incident = loadDemoIncident();
    const result = IncidentSchema.safeParse(incident);
    expect(result.success).toBe(true);
  });

  test('returns the demo-001 incident with correct id', () => {
    const incident = loadDemoIncident();
    expect(incident.id).toBe('demo-001');
  });

  test('returns the correct service', () => {
    const incident = loadDemoIncident();
    expect(incident.service).toBe('checkout-service');
  });

  test('returns severity "high"', () => {
    const incident = loadDemoIncident();
    expect(incident.severity).toBe('high');
  });

  test('returns mode "demo"', () => {
    const incident = loadDemoIncident();
    expect(incident.mode).toBe('demo');
  });

  test('returns the correct title', () => {
    const incident = loadDemoIncident();
    expect(incident.title).toBe('Checkout Service Latency Spike');
  });

  test('returns a 30-minute window (startTime to endTime)', () => {
    const incident = loadDemoIncident();
    const start = new Date(incident.startTime).getTime();
    const end = new Date(incident.endTime).getTime();
    const durationMinutes = (end - start) / (1000 * 60);
    expect(durationMinutes).toBe(30);
  });

  test('returns valid ISO startTime', () => {
    const incident = loadDemoIncident();
    expect(incident.startTime).toBe('2024-01-15T10:00:00Z');
  });

  test('returns valid ISO endTime', () => {
    const incident = loadDemoIncident();
    expect(incident.endTime).toBe('2024-01-15T10:30:00Z');
  });

  test('returns a non-empty description', () => {
    const incident = loadDemoIncident();
    expect(incident.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// loadDemoEvidence
// ---------------------------------------------------------------------------

describe('loadDemoEvidence', () => {
  let evidence: ReturnType<typeof loadDemoEvidence>;

  beforeAll(() => {
    evidence = loadDemoEvidence();
  });

  // ── Schema validation ────────────────────────────────────────────────────

  test('returns an array', () => {
    expect(Array.isArray(evidence)).toBe(true);
  });

  test('every item passes EvidenceItemSchema validation', () => {
    evidence.forEach((item, index) => {
      const result = EvidenceItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (!result.success) {
        // Surface the first validation error for easier debugging
        throw new Error(`Item at index ${index} failed validation: ${result.error.message}`);
      }
    });
  });

  // ── Counts ───────────────────────────────────────────────────────────────

  test('returns exactly 22 total evidence items', () => {
    expect(evidence).toHaveLength(22);
  });

  test('contains exactly 15 log items', () => {
    const logs = evidence.filter((item) => item.type === 'log');
    expect(logs).toHaveLength(15);
  });

  test('contains exactly 3 metric items', () => {
    const metrics = evidence.filter((item) => item.type === 'metric');
    expect(metrics).toHaveLength(3);
  });

  test('contains exactly 3 trace items', () => {
    const traces = evidence.filter((item) => item.type === 'trace');
    expect(traces).toHaveLength(3);
  });

  test('contains exactly 1 deployment item', () => {
    const deployments = evidence.filter((item) => item.type === 'deployment');
    expect(deployments).toHaveLength(1);
  });

  // ── All 4 types present ──────────────────────────────────────────────────

  test('contains items of all 4 types: log, metric, trace, deployment', () => {
    const types = new Set(evidence.map((item) => item.type));
    expect(types.has('log')).toBe(true);
    expect(types.has('metric')).toBe(true);
    expect(types.has('trace')).toBe(true);
    expect(types.has('deployment')).toBe(true);
  });

  // ── Timestamps ───────────────────────────────────────────────────────────

  test('all evidence items have valid ISO timestamps', () => {
    evidence.forEach((item, index) => {
      const parsed = Date.parse(item.timestamp);
      expect(Number.isNaN(parsed)).toBe(false);
      // Also verify the schema accepts it (ISO 8601 with offset)
      const result = EvidenceItemSchema.shape.timestamp.safeParse(item.timestamp);
      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(`Item at index ${index} has invalid timestamp "${item.timestamp}"`);
      }
    });
  });

  // ── Non-empty required string fields ────────────────────────────────────

  test('all evidence items have non-empty id', () => {
    evidence.forEach((item, index) => {
      expect(item.id.length).toBeGreaterThan(0);
    });
  });

  test('all evidence items have non-empty source', () => {
    evidence.forEach((item, index) => {
      expect(item.source.length).toBeGreaterThan(0);
    });
  });

  test('all evidence items have non-empty summary', () => {
    evidence.forEach((item, index) => {
      expect(item.summary.length).toBeGreaterThan(0);
    });
  });

  // ── ID uniqueness ────────────────────────────────────────────────────────

  test('all evidence item ids are unique', () => {
    const ids = evidence.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // ── Type-specific id prefixes ────────────────────────────────────────────

  test('log items have ids prefixed with "log-"', () => {
    evidence
      .filter((item) => item.type === 'log')
      .forEach((item) => {
        expect(item.id).toMatch(/^log-\d+$/);
      });
  });

  test('metric items have ids prefixed with "metric-"', () => {
    evidence
      .filter((item) => item.type === 'metric')
      .forEach((item) => {
        expect(item.id).toMatch(/^metric-\d+$/);
      });
  });

  test('trace items have ids prefixed with "trace-"', () => {
    evidence
      .filter((item) => item.type === 'trace')
      .forEach((item) => {
        expect(item.id).toMatch(/^trace-\d+$/);
      });
  });

  test('deployment items have ids prefixed with "deployment-"', () => {
    evidence
      .filter((item) => item.type === 'deployment')
      .forEach((item) => {
        expect(item.id).toMatch(/^deployment-\d+$/);
      });
  });

  // ── Data field is populated ──────────────────────────────────────────────

  test('all evidence items have a non-null data field', () => {
    evidence.forEach((item) => {
      expect(item.data).not.toBeNull();
      expect(item.data).not.toBeUndefined();
    });
  });
});
