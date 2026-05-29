import {
  normalizeLog,
  normalizeMetric,
  normalizeTrace,
  normalizeDeployment,
  normalizeAll,
  maskSensitiveFields,
} from '@/lib/analysis/evidenceNormalizer';
import { EvidenceItemSchema } from '@/lib/shared/validation';
import type { EvidenceItem } from '@/lib/types';

// ---------------------------------------------------------------------------
// Shared raw fixtures
// ---------------------------------------------------------------------------

const rawLog = {
  timestamp: '2024-01-15T10:00:14Z',
  level: 'ERROR',
  service: 'checkout-service',
  message: 'ETIMEDOUT connecting to redis:6379',
};

const rawMetric = {
  name: 'checkout.latency.p99',
  unit: 'ms',
  service: 'checkout-service',
  dataPoints: [
    { timestamp: '2024-01-15T09:50:00Z', value: 118 },
    { timestamp: '2024-01-15T09:55:00Z', value: 122 },
  ],
};

const rawTrace = {
  traceId: 'a1b2c3d4e5f60004',
  rootSpan: 'checkout-service',
  spans: [
    {
      spanId: 'f1e2d3c4b5a60004',
      parentSpanId: null,
      service: 'checkout-service',
      operation: 'POST /api/checkout',
      startTime: '2024-01-15T10:02:18Z',
      durationMs: 1800,
      status: 'ok',
    },
    {
      spanId: 'f1e2d3c4b5a60043',
      parentSpanId: 'f1e2d3c4b5a60004',
      service: 'checkout-service',
      operation: 'redis GET session:cart:***',
      startTime: '2024-01-15T10:02:18.050Z',
      durationMs: 850,
      status: 'timeout',
    },
    {
      spanId: 'f1e2d3c4b5a60044',
      parentSpanId: 'f1e2d3c4b5a60004',
      service: 'payment-service',
      operation: 'redis SET idempotency:payment:***',
      startTime: '2024-01-15T10:02:18.250Z',
      durationMs: 900,
      status: 'error',
    },
  ],
};

const rawDeployment = {
  id: 'deploy-20240115-001',
  service: 'payment-service',
  version: 'v2.4.1',
  previousVersion: 'v2.4.0',
  timestamp: '2024-01-15T09:52:00Z',
  deployedBy: 'ci-pipeline',
  environment: 'production',
};

// ---------------------------------------------------------------------------
// 1. Type assignment
// ---------------------------------------------------------------------------

describe('type assignment', () => {
  test('normalizeLog sets type to "log"', () => {
    const item = normalizeLog(rawLog, 'log-1');
    expect(item.type).toBe('log');
  });

  test('normalizeMetric sets type to "metric"', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    expect(item.type).toBe('metric');
  });

  test('normalizeTrace sets type to "trace"', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    expect(item.type).toBe('trace');
  });

  test('normalizeDeployment sets type to "deployment"', () => {
    const item = normalizeDeployment(rawDeployment, 'deployment-1');
    expect(item.type).toBe('deployment');
  });
});

// ---------------------------------------------------------------------------
// 2. Schema validation
// ---------------------------------------------------------------------------

describe('schema validation', () => {
  test('normalizeLog output passes EvidenceItemSchema', () => {
    const item = normalizeLog(rawLog, 'log-1');
    const result = EvidenceItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  test('normalizeMetric output passes EvidenceItemSchema', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    const result = EvidenceItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  test('normalizeTrace output passes EvidenceItemSchema', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    const result = EvidenceItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  test('normalizeDeployment output passes EvidenceItemSchema', () => {
    const item = normalizeDeployment(rawDeployment, 'deployment-1');
    const result = EvidenceItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Timestamp normalization
// ---------------------------------------------------------------------------

describe('timestamp normalization', () => {
  test('normalizeLog uses raw.timestamp when present', () => {
    const item = normalizeLog(rawLog, 'log-1');
    expect(item.timestamp).toBe('2024-01-15T10:00:14Z');
  });

  test('normalizeLog falls back to a valid ISO string when timestamp is missing', () => {
    const before = Date.now();
    const item = normalizeLog({ level: 'INFO', service: 'svc', message: 'hi' }, 'log-x');
    const after = Date.now();
    const parsed = Date.parse(item.timestamp);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  test('normalizeMetric uses the first dataPoint timestamp', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    expect(item.timestamp).toBe('2024-01-15T09:50:00Z');
  });

  test('normalizeMetric falls back to a valid ISO string when dataPoints is empty', () => {
    const before = Date.now();
    const item = normalizeMetric(
      { name: 'cpu', unit: '%', service: 'svc', dataPoints: [] },
      'metric-x'
    );
    const after = Date.now();
    const parsed = Date.parse(item.timestamp);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  test('normalizeTrace uses the root span startTime', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    expect(item.timestamp).toBe('2024-01-15T10:02:18Z');
  });

  test('normalizeTrace falls back to a valid ISO string when spans is empty', () => {
    const before = Date.now();
    const item = normalizeTrace(
      { traceId: 'xyz', rootSpan: 'svc', spans: [] },
      'trace-x'
    );
    const after = Date.now();
    const parsed = Date.parse(item.timestamp);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  test('normalizeDeployment uses raw.timestamp when present', () => {
    const item = normalizeDeployment(rawDeployment, 'deployment-1');
    expect(item.timestamp).toBe('2024-01-15T09:52:00Z');
  });

  test('normalizeDeployment falls back to a valid ISO string when timestamp is missing', () => {
    const before = Date.now();
    const item = normalizeDeployment(
      { service: 'svc', version: 'v1', previousVersion: 'v0', environment: 'prod', deployedBy: 'ci' },
      'deployment-x'
    );
    const after = Date.now();
    const parsed = Date.parse(item.timestamp);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// 4. Source extraction
// ---------------------------------------------------------------------------

describe('source extraction', () => {
  test('normalizeLog extracts source from raw.service', () => {
    const item = normalizeLog(rawLog, 'log-1');
    expect(item.source).toBe('checkout-service');
  });

  test('normalizeMetric extracts source from raw.service', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    expect(item.source).toBe('checkout-service');
  });

  test('normalizeTrace extracts source from raw.rootSpan', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    expect(item.source).toBe('checkout-service');
  });

  test('normalizeDeployment extracts source from raw.service', () => {
    const item = normalizeDeployment(rawDeployment, 'deployment-1');
    expect(item.source).toBe('payment-service');
  });
});

// ---------------------------------------------------------------------------
// 5. Summary generation
// ---------------------------------------------------------------------------

describe('summary generation', () => {
  test('normalizeLog summary is non-empty', () => {
    const item = normalizeLog(rawLog, 'log-1');
    expect(item.summary.length).toBeGreaterThan(0);
  });

  test('normalizeLog summary contains level and service', () => {
    const item = normalizeLog(rawLog, 'log-1');
    expect(item.summary).toContain('ERROR');
    expect(item.summary).toContain('checkout-service');
  });

  test('normalizeMetric summary is non-empty', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    expect(item.summary.length).toBeGreaterThan(0);
  });

  test('normalizeMetric summary contains metric name and service', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    expect(item.summary).toContain('checkout.latency.p99');
    expect(item.summary).toContain('checkout-service');
  });

  test('normalizeMetric summary contains data point count', () => {
    const item = normalizeMetric(rawMetric, 'metric-1');
    expect(item.summary).toContain('2 data points');
  });

  test('normalizeTrace summary is non-empty', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    expect(item.summary.length).toBeGreaterThan(0);
  });

  test('normalizeTrace summary contains traceId and span count', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    expect(item.summary).toContain('a1b2c3d4e5f60004');
    expect(item.summary).toContain('3 spans');
  });

  test('normalizeTrace summary contains error/timeout span count', () => {
    const item = normalizeTrace(rawTrace, 'trace-1');
    // 2 spans have status 'timeout' or 'error'
    expect(item.summary).toContain('2 error/timeout span(s)');
  });

  test('normalizeDeployment summary is non-empty', () => {
    const item = normalizeDeployment(rawDeployment, 'deployment-1');
    expect(item.summary.length).toBeGreaterThan(0);
  });

  test('normalizeDeployment summary contains service, version, and environment', () => {
    const item = normalizeDeployment(rawDeployment, 'deployment-1');
    expect(item.summary).toContain('payment-service');
    expect(item.summary).toContain('v2.4.1');
    expect(item.summary).toContain('production');
  });
});

// ---------------------------------------------------------------------------
// 6. maskSensitiveFields — masks all 9 sensitive field names
// ---------------------------------------------------------------------------

describe('maskSensitiveFields — sensitive field masking', () => {
  const sensitiveKeys = [
    'token',
    'password',
    'secret',
    'key',
    'authorization',
    'auth',
    'credential',
    'apiKey',
    'api_key',
  ];

  sensitiveKeys.forEach((sensitiveKey) => {
    test(`masks field "${sensitiveKey}" with "***"`, () => {
      const item: EvidenceItem = {
        id: 'log-1',
        type: 'log',
        timestamp: '2024-01-15T10:00:14Z',
        source: 'svc',
        data: { [sensitiveKey]: 'super-secret-value', other: 'visible' },
        summary: 'test',
      };
      const [masked] = maskSensitiveFields([item]);
      const data = masked.data as Record<string, unknown>;
      expect(data[sensitiveKey]).toBe('***');
    });
  });
});

// ---------------------------------------------------------------------------
// 7. maskSensitiveFields — non-sensitive fields are preserved
// ---------------------------------------------------------------------------

describe('maskSensitiveFields — non-sensitive fields preserved', () => {
  test('non-sensitive fields are unchanged after masking', () => {
    const item: EvidenceItem = {
      id: 'log-1',
      type: 'log',
      timestamp: '2024-01-15T10:00:14Z',
      source: 'svc',
      data: {
        service: 'checkout-service',
        level: 'ERROR',
        message: 'something went wrong',
        count: 42,
        active: true,
      },
      summary: 'test',
    };
    const [masked] = maskSensitiveFields([item]);
    const data = masked.data as Record<string, unknown>;
    expect(data['service']).toBe('checkout-service');
    expect(data['level']).toBe('ERROR');
    expect(data['message']).toBe('something went wrong');
    expect(data['count']).toBe(42);
    expect(data['active']).toBe(true);
  });

  test('top-level EvidenceItem fields (id, type, timestamp, source, summary) are unchanged', () => {
    const item: EvidenceItem = {
      id: 'log-99',
      type: 'log',
      timestamp: '2024-01-15T10:00:14Z',
      source: 'my-service',
      data: { password: 'secret123' },
      summary: 'a summary',
    };
    const [masked] = maskSensitiveFields([item]);
    expect(masked.id).toBe('log-99');
    expect(masked.type).toBe('log');
    expect(masked.timestamp).toBe('2024-01-15T10:00:14Z');
    expect(masked.source).toBe('my-service');
    expect(masked.summary).toBe('a summary');
  });
});

// ---------------------------------------------------------------------------
// 8. maskSensitiveFields — recursive masking on nested objects
// ---------------------------------------------------------------------------

describe('maskSensitiveFields — recursive masking', () => {
  test('masks sensitive fields in nested objects', () => {
    const item: EvidenceItem = {
      id: 'log-1',
      type: 'log',
      timestamp: '2024-01-15T10:00:14Z',
      source: 'svc',
      data: {
        service: 'checkout-service',
        nested: {
          token: 'abc123',
          deepNested: {
            password: 'hunter2',
            visible: 'keep-me',
          },
        },
      },
      summary: 'test',
    };
    const [masked] = maskSensitiveFields([item]);
    const data = masked.data as Record<string, unknown>;
    const nested = data['nested'] as Record<string, unknown>;
    const deepNested = nested['deepNested'] as Record<string, unknown>;

    expect(nested['token']).toBe('***');
    expect(deepNested['password']).toBe('***');
    expect(deepNested['visible']).toBe('keep-me');
  });

  test('masks sensitive fields inside arrays of objects', () => {
    const item: EvidenceItem = {
      id: 'log-1',
      type: 'log',
      timestamp: '2024-01-15T10:00:14Z',
      source: 'svc',
      data: {
        items: [
          { name: 'a', secret: 'shh' },
          { name: 'b', secret: 'also-shh' },
        ],
      },
      summary: 'test',
    };
    const [masked] = maskSensitiveFields([item]);
    const data = masked.data as Record<string, unknown>;
    const items = data['items'] as Array<Record<string, unknown>>;
    expect(items[0]['secret']).toBe('***');
    expect(items[1]['secret']).toBe('***');
    expect(items[0]['name']).toBe('a');
    expect(items[1]['name']).toBe('b');
  });

  test('returns a new array (does not mutate the original)', () => {
    const originalData = { token: 'original-token', visible: 'hello' };
    const item: EvidenceItem = {
      id: 'log-1',
      type: 'log',
      timestamp: '2024-01-15T10:00:14Z',
      source: 'svc',
      data: originalData,
      summary: 'test',
    };
    maskSensitiveFields([item]);
    // Original data should be untouched
    expect(originalData.token).toBe('original-token');
  });
});

// ---------------------------------------------------------------------------
// 9. normalizeAll — returns correct total count and all 4 types
// ---------------------------------------------------------------------------

describe('normalizeAll', () => {
  const logs = [rawLog, { ...rawLog, service: 'payment-service' }];
  const metrics = [rawMetric];
  const traces = [rawTrace];
  const deployments = [rawDeployment];

  let result: ReturnType<typeof normalizeAll>;

  beforeAll(() => {
    result = normalizeAll(logs, metrics, traces, deployments);
  });

  test('returns the correct total count (logs + metrics + traces + deployments)', () => {
    expect(result).toHaveLength(
      logs.length + metrics.length + traces.length + deployments.length
    );
  });

  test('contains log items equal to the number of raw logs', () => {
    const logItems = result.filter((item) => item.type === 'log');
    expect(logItems).toHaveLength(logs.length);
  });

  test('contains metric items equal to the number of raw metrics', () => {
    const metricItems = result.filter((item) => item.type === 'metric');
    expect(metricItems).toHaveLength(metrics.length);
  });

  test('contains trace items equal to the number of raw traces', () => {
    const traceItems = result.filter((item) => item.type === 'trace');
    expect(traceItems).toHaveLength(traces.length);
  });

  test('contains deployment items equal to the number of raw deployments', () => {
    const deploymentItems = result.filter((item) => item.type === 'deployment');
    expect(deploymentItems).toHaveLength(deployments.length);
  });

  test('all 4 types are present in the output', () => {
    const types = new Set(result.map((item) => item.type));
    expect(types.has('log')).toBe(true);
    expect(types.has('metric')).toBe(true);
    expect(types.has('trace')).toBe(true);
    expect(types.has('deployment')).toBe(true);
  });

  test('log ids are prefixed with "log-"', () => {
    result
      .filter((item) => item.type === 'log')
      .forEach((item) => expect(item.id).toMatch(/^log-\d+$/));
  });

  test('metric ids are prefixed with "metric-"', () => {
    result
      .filter((item) => item.type === 'metric')
      .forEach((item) => expect(item.id).toMatch(/^metric-\d+$/));
  });

  test('trace ids are prefixed with "trace-"', () => {
    result
      .filter((item) => item.type === 'trace')
      .forEach((item) => expect(item.id).toMatch(/^trace-\d+$/));
  });

  test('deployment ids are prefixed with "deployment-"', () => {
    result
      .filter((item) => item.type === 'deployment')
      .forEach((item) => expect(item.id).toMatch(/^deployment-\d+$/));
  });

  test('returns empty array when all inputs are empty', () => {
    expect(normalizeAll([], [], [], [])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Graceful handling — normalizers don't throw on missing/null fields
// ---------------------------------------------------------------------------

describe('graceful handling of missing/null fields', () => {
  test('normalizeLog does not throw on empty object', () => {
    expect(() => normalizeLog({}, 'log-x')).not.toThrow();
  });

  test('normalizeLog does not throw on null', () => {
    expect(() => normalizeLog(null, 'log-x')).not.toThrow();
  });

  test('normalizeLog does not throw on undefined', () => {
    expect(() => normalizeLog(undefined, 'log-x')).not.toThrow();
  });

  test('normalizeMetric does not throw on empty object', () => {
    expect(() => normalizeMetric({}, 'metric-x')).not.toThrow();
  });

  test('normalizeMetric does not throw on null', () => {
    expect(() => normalizeMetric(null, 'metric-x')).not.toThrow();
  });

  test('normalizeMetric does not throw when dataPoints is missing', () => {
    expect(() =>
      normalizeMetric({ name: 'cpu', unit: '%', service: 'svc' }, 'metric-x')
    ).not.toThrow();
  });

  test('normalizeTrace does not throw on empty object', () => {
    expect(() => normalizeTrace({}, 'trace-x')).not.toThrow();
  });

  test('normalizeTrace does not throw on null', () => {
    expect(() => normalizeTrace(null, 'trace-x')).not.toThrow();
  });

  test('normalizeTrace does not throw when spans is missing', () => {
    expect(() =>
      normalizeTrace({ traceId: 'abc', rootSpan: 'svc' }, 'trace-x')
    ).not.toThrow();
  });

  test('normalizeDeployment does not throw on empty object', () => {
    expect(() => normalizeDeployment({}, 'deployment-x')).not.toThrow();
  });

  test('normalizeDeployment does not throw on null', () => {
    expect(() => normalizeDeployment(null, 'deployment-x')).not.toThrow();
  });

  test('normalizeLog with missing fields still returns a valid id', () => {
    const item = normalizeLog({}, 'log-fallback');
    expect(item.id).toBe('log-fallback');
  });

  test('normalizeMetric with missing fields still returns type "metric"', () => {
    const item = normalizeMetric({}, 'metric-fallback');
    expect(item.type).toBe('metric');
  });

  test('normalizeTrace with missing fields still returns type "trace"', () => {
    const item = normalizeTrace({}, 'trace-fallback');
    expect(item.type).toBe('trace');
  });

  test('normalizeDeployment with missing fields still returns type "deployment"', () => {
    const item = normalizeDeployment({}, 'deployment-fallback');
    expect(item.type).toBe('deployment');
  });
});
