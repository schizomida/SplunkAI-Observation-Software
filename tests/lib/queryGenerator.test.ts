import { generateQueries } from '@/lib/analysis/queryGenerator';
import { InvestigationQuerySchema } from '@/lib/shared/validation';
import { Incident } from '@/lib/types';

// ---------------------------------------------------------------------------
// Shared test fixture
// ---------------------------------------------------------------------------

const baseIncident: Incident = {
  id: 'test-001',
  title: 'Test Incident',
  service: 'checkout-service',
  severity: 'high',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:30:00Z',
  mode: 'demo',
  description: 'A test incident for unit testing.',
};

// ---------------------------------------------------------------------------
// generateQueries — count and schema
// ---------------------------------------------------------------------------

describe('generateQueries — count and schema', () => {
  let queries: ReturnType<typeof generateQueries>;

  beforeAll(() => {
    queries = generateQueries(baseIncident);
  });

  test('returns exactly 5 queries', () => {
    expect(queries).toHaveLength(5);
  });

  test('every query passes InvestigationQuerySchema validation', () => {
    queries.forEach((query, index) => {
      const result = InvestigationQuerySchema.safeParse(query);
      if (!result.success) {
        throw new Error(
          `Query at index ${index} failed schema validation: ${result.error.message}`
        );
      }
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// generateQueries — field completeness
// ---------------------------------------------------------------------------

describe('generateQueries — field completeness', () => {
  let queries: ReturnType<typeof generateQueries>;

  beforeAll(() => {
    queries = generateQueries(baseIncident);
  });

  test('all 5 queries have unique ids', () => {
    const ids = queries.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  test('all 5 queries have non-empty name', () => {
    queries.forEach((q) => {
      expect(q.name.length).toBeGreaterThan(0);
    });
  });

  test('all 5 queries have non-empty description', () => {
    queries.forEach((q) => {
      expect(q.description.length).toBeGreaterThan(0);
    });
  });

  test('all 5 queries have non-empty spl', () => {
    queries.forEach((q) => {
      expect(q.spl.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// generateQueries — service name interpolation
// ---------------------------------------------------------------------------

describe('generateQueries — service name interpolation', () => {
  test('the incident service name appears in at least 2 SPL strings', () => {
    const incident: Incident = { ...baseIncident, service: 'payment-service' };
    const queries = generateQueries(incident);
    const queriesWithService = queries.filter((q) => q.spl.includes('payment-service'));
    expect(queriesWithService.length).toBeGreaterThanOrEqual(2);
  });

  test('a different service name is correctly interpolated', () => {
    const incident: Incident = { ...baseIncident, service: 'auth-service' };
    const queries = generateQueries(incident);
    const queriesWithService = queries.filter((q) => q.spl.includes('auth-service'));
    expect(queriesWithService.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// generateQueries — risk levels
// ---------------------------------------------------------------------------

describe('generateQueries — risk levels', () => {
  let queries: ReturnType<typeof generateQueries>;

  beforeAll(() => {
    queries = generateQueries(baseIncident);
  });

  test('exactly 2 queries have riskLevel "low"', () => {
    const lowRisk = queries.filter((q) => q.riskLevel === 'low');
    expect(lowRisk).toHaveLength(2);
  });

  test('exactly 2 queries have riskLevel "medium"', () => {
    const mediumRisk = queries.filter((q) => q.riskLevel === 'medium');
    expect(mediumRisk).toHaveLength(2);
  });

  test('exactly 1 query has riskLevel "high"', () => {
    const highRisk = queries.filter((q) => q.riskLevel === 'high');
    expect(highRisk).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// generateQueries — specific query ids
// ---------------------------------------------------------------------------

describe('generateQueries — specific query ids', () => {
  let queryIds: string[];

  beforeAll(() => {
    queryIds = generateQueries(baseIncident).map((q) => q.id);
  });

  test('contains query id "error-rate-spike"', () => {
    expect(queryIds).toContain('error-rate-spike');
  });

  test('contains query id "latency-percentiles"', () => {
    expect(queryIds).toContain('latency-percentiles');
  });

  test('contains query id "deployment-correlation"', () => {
    expect(queryIds).toContain('deployment-correlation');
  });

  test('contains query id "dependency-timeout"', () => {
    expect(queryIds).toContain('dependency-timeout');
  });

  test('contains query id "host-pod-impact"', () => {
    expect(queryIds).toContain('host-pod-impact');
  });
});

// ---------------------------------------------------------------------------
// generateQueries — injection rejection
// ---------------------------------------------------------------------------

describe('generateQueries — injection rejection', () => {
  const injectionCases: Array<{ label: string; service: string }> = [
    { label: 'pipe character', service: 'svc|drop index=*' },
    { label: 'semicolon', service: 'svc;rm -rf /' },
    { label: 'backtick', service: 'svc`whoami`' },
    { label: 'single quote', service: "svc'OR 1=1" },
    { label: 'double quote', service: 'svc"OR 1=1' },
    { label: 'dollar sign', service: 'svc$HOME' },
    { label: 'newline', service: 'svc\nindex=*' },
    { label: 'open bracket', service: 'svc[subsearch]' },
    { label: 'open paren', service: 'svc(eval)' },
    { label: 'space', service: 'svc name' },
  ];

  injectionCases.forEach(({ label, service }) => {
    test(`throws when service name contains ${label}`, () => {
      const incident: Incident = { ...baseIncident, service };
      expect(() => generateQueries(incident)).toThrow();
    });
  });
});
