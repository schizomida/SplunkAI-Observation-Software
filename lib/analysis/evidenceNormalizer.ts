import type { EvidenceItem } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely reads a property from an unknown value.
 * Returns undefined if the value is not an object or the property doesn't exist.
 */
function getProp(raw: unknown, key: string): unknown {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return (raw as Record<string, unknown>)[key];
  }
  return undefined;
}

function getString(raw: unknown, key: string, fallback = ''): string {
  const val = getProp(raw, key);
  return typeof val === 'string' ? val : fallback;
}

function getNumber(raw: unknown, key: string, fallback = 0): number {
  const val = getProp(raw, key);
  return typeof val === 'number' ? val : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Sensitive field masking ───────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'token',
  'password',
  'secret',
  'key',
  'authorization',
  'auth',
  'credential',
  'apiKey',
  'api_key',
]);

/**
 * Recursively masks sensitive fields in an object, returning a new object.
 * Non-object values are returned as-is.
 */
function maskObject(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(maskObject);
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      result[k] = '***';
    } else {
      result[k] = maskObject(v);
    }
  }

  return result;
}

/**
 * Returns a new array of EvidenceItems where sensitive fields inside each
 * item's `data` object are replaced with `'***'`.
 *
 * Sensitive field names: token, password, secret, key, authorization, auth,
 * credential, apiKey, api_key.
 *
 * Masking is applied recursively to nested objects.
 */
export function maskSensitiveFields(evidence: EvidenceItem[]): EvidenceItem[] {
  return evidence.map((item) => ({
    ...item,
    data: maskObject(item.data),
  }));
}

// ── Individual normalizers ────────────────────────────────────────────────────

/**
 * Converts a raw log object to an EvidenceItem with type='log'.
 *
 * - timestamp: raw.timestamp (falls back to current time)
 * - source:    raw.service
 * - summary:   "[<level>] <service>: <message>"
 */
export function normalizeLog(raw: unknown, id: string): EvidenceItem {
  const timestamp = getString(raw, 'timestamp') || nowIso();
  const source = getString(raw, 'service');
  const level = getString(raw, 'level', 'UNKNOWN');
  const message = getString(raw, 'message');
  const summary = `[${level}] ${source}: ${message}`;

  return { id, type: 'log', timestamp, source, data: raw, summary };
}

/**
 * Converts a raw metric series to an EvidenceItem with type='metric'.
 *
 * - timestamp: first dataPoint's timestamp (falls back to current time)
 * - source:    raw.service
 * - summary:   'Metric series "<name>" (<unit>) for <service> — N data points'
 */
export function normalizeMetric(raw: unknown, id: string): EvidenceItem {
  const source = getString(raw, 'service');
  const name = getString(raw, 'name');
  const unit = getString(raw, 'unit');

  const dataPoints = getProp(raw, 'dataPoints');
  const firstPoint = Array.isArray(dataPoints) ? dataPoints[0] : undefined;
  const timestamp =
    firstPoint && typeof firstPoint === 'object' && firstPoint !== null
      ? (String((firstPoint as Record<string, unknown>)['timestamp'] ?? '') || nowIso())
      : nowIso();

  const pointCount = Array.isArray(dataPoints) ? dataPoints.length : 0;
  const summary = `Metric series "${name}" (${unit}) for ${source} — ${pointCount} data points`;

  return { id, type: 'metric', timestamp, source, data: raw, summary };
}

/**
 * Converts a raw trace to an EvidenceItem with type='trace'.
 *
 * - timestamp: startTime of the root span (parentSpanId === null), falls back to current time
 * - source:    raw.rootSpan
 * - summary:   'Trace <traceId> — N spans, M error/timeout span(s) rooted at <rootSpan>'
 */
export function normalizeTrace(raw: unknown, id: string): EvidenceItem {
  const source = getString(raw, 'rootSpan');
  const traceId = getString(raw, 'traceId');

  const spans = getProp(raw, 'spans');
  const spansArray: unknown[] = Array.isArray(spans) ? spans : [];

  const rootSpan = spansArray.find(
    (s) => getProp(s, 'parentSpanId') === null
  );

  const timestamp =
    rootSpan != null
      ? (getString(rootSpan, 'startTime') || nowIso())
      : nowIso();

  const spanCount = spansArray.length;
  const errorSpans = spansArray.filter((s) => {
    const status = getString(s, 'status');
    return status === 'error' || status === 'timeout';
  }).length;

  const summary = `Trace ${traceId} — ${spanCount} spans, ${errorSpans} error/timeout span(s) rooted at ${source}`;

  return { id, type: 'trace', timestamp, source, data: raw, summary };
}

/**
 * Converts a raw deployment event to an EvidenceItem with type='deployment'.
 *
 * - timestamp: raw.timestamp (falls back to current time)
 * - source:    raw.service
 * - summary:   'Deployment of <service> <version> (prev: <previousVersion>) to <environment> by <deployedBy>'
 */
export function normalizeDeployment(raw: unknown, id: string): EvidenceItem {
  const timestamp = getString(raw, 'timestamp') || nowIso();
  const source = getString(raw, 'service');
  const version = getString(raw, 'version');
  const previousVersion = getString(raw, 'previousVersion');
  const environment = getString(raw, 'environment');
  const deployedBy = getString(raw, 'deployedBy');

  const summary = `Deployment of ${source} ${version} (prev: ${previousVersion}) to ${environment} by ${deployedBy}`;

  return { id, type: 'deployment', timestamp, source, data: raw, summary };
}

// ── Batch normalizer ──────────────────────────────────────────────────────────

/**
 * Normalizes all raw observability data into a flat array of EvidenceItems.
 *
 * IDs are assigned as: log-1, log-2, …, metric-1, …, trace-1, …, deployment-1, …
 */
export function normalizeAll(
  logs: unknown[],
  metrics: unknown[],
  traces: unknown[],
  deployments: unknown[]
): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  logs.forEach((log, i) => evidence.push(normalizeLog(log, `log-${i + 1}`)));
  metrics.forEach((metric, i) => evidence.push(normalizeMetric(metric, `metric-${i + 1}`)));
  traces.forEach((trace, i) => evidence.push(normalizeTrace(trace, `trace-${i + 1}`)));
  deployments.forEach((dep, i) => evidence.push(normalizeDeployment(dep, `deployment-${i + 1}`)));

  return evidence;
}
