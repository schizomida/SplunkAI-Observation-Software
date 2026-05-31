/**
 * Ingest Extended Demo Data into Splunk via HTTP Event Collector (HEC)
 *
 * This script generates and sends a rich dataset into Splunk:
 * - 50+ log entries (ERROR, WARN, INFO, DEBUG across 5 services)
 * - 100+ metric data points (5 metrics × 20+ time intervals)
 * - 20+ trace spans (5 traces with 4 spans each)
 * - 3 deployment events (showing a sequence of deploys)
 *
 * All timestamps are relative to "now" so data is always fresh.
 *
 * Prerequisites:
 *   1. Splunk Enterprise running locally
 *   2. HEC enabled (Settings → Data Inputs → HTTP Event Collector)
 *   3. .env.local configured with SPLUNK_HEC_TOKEN
 *
 * Usage:
 *   node scripts/ingest-extended-data.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Load .env.local if it exists ──────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ── Configuration ─────────────────────────────────────────────────────────────
const HEC_HOST = process.env.SPLUNK_HOST || 'localhost';
const HEC_PORT = parseInt(process.env.SPLUNK_HEC_PORT || '8088', 10);
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN || '';
const INDEX = process.env.SPLUNK_INDEX || 'main';

if (!HEC_TOKEN) {
  console.error('ERROR: SPLUNK_HEC_TOKEN is not set in .env.local');
  console.error('Add SPLUNK_HEC_TOKEN=<your-token> to .env.local');
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Data Generation Helpers ───────────────────────────────────────────────────

const SERVICES = ['checkout-service', 'payment-api', 'inventory-service', 'user-auth', 'notification-service'];
const HOSTS = ['prod-web-01', 'prod-web-02', 'prod-api-01', 'prod-api-02', 'prod-worker-01'];
const METRICS = ['cpu_utilization', 'memory_usage_mb', 'request_latency_ms', 'active_connections', 'error_rate_pct'];
const LOG_LEVELS = ['ERROR', 'WARN', 'INFO', 'INFO', 'INFO', 'DEBUG', 'DEBUG']; // weighted toward INFO/DEBUG
const OPERATIONS = ['GET /api/checkout', 'POST /api/payment', 'GET /api/inventory', 'POST /api/auth/login', 'POST /api/notify'];

const ERROR_MESSAGES = [
  'Connection timeout to downstream service',
  'Database query exceeded 5000ms threshold',
  'Circuit breaker OPEN for payment-api',
  'Out of memory: heap allocation failed',
  'TLS handshake timeout after 30s',
  'Rate limit exceeded: 429 Too Many Requests',
  'Null pointer exception in OrderProcessor',
  'Redis connection pool exhausted',
  'gRPC deadline exceeded for inventory lookup',
  'Kafka consumer lag exceeding 10000 messages',
];

const WARN_MESSAGES = [
  'Connection pool utilization at 85%',
  'Response time degradation detected (p99 > 2000ms)',
  'Retry attempt 3/5 for downstream call',
  'Memory usage approaching threshold (92%)',
  'Slow database query detected (3200ms)',
  'Certificate expiring in 7 days',
  'Thread pool saturation warning',
  'Cache miss rate elevated (45%)',
];

const INFO_MESSAGES = [
  'Request processed successfully',
  'Health check passed',
  'Cache refreshed for product catalog',
  'Batch job completed: 1500 records processed',
  'Connection established to database cluster',
  'Feature flag "new-checkout-flow" enabled',
  'Metrics flush completed (250 data points)',
  'Session cleanup: removed 340 expired sessions',
  'Auto-scaling triggered: 3 → 5 instances',
  'Deployment webhook received',
];

const DEBUG_MESSAGES = [
  'Entering OrderProcessor.processOrder()',
  'SQL query: SELECT * FROM orders WHERE status=pending',
  'HTTP request: GET /api/inventory/check?sku=ABC123',
  'Cache lookup: key=user:12345:session, hit=true',
  'Serializing response payload (2.3KB)',
  'JWT token validated, expiry: 2h remaining',
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTimestamp(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

// ── Generate Log Entries (50+) ────────────────────────────────────────────────

function generateLogs() {
  const logs = [];

  // Generate 55 log entries spread over last 2 hours
  for (let i = 0; i < 55; i++) {
    const minutesAgo = randomBetween(1, 120);
    const timestamp = generateTimestamp(minutesAgo);
    const service = randomChoice(SERVICES);
    const host = randomChoice(HOSTS);
    const level = randomChoice(LOG_LEVELS);

    let message;
    switch (level) {
      case 'ERROR':
        message = randomChoice(ERROR_MESSAGES);
        break;
      case 'WARN':
        message = randomChoice(WARN_MESSAGES);
        break;
      case 'INFO':
        message = randomChoice(INFO_MESSAGES);
        break;
      case 'DEBUG':
        message = randomChoice(DEBUG_MESSAGES);
        break;
      default:
        message = 'Unknown log event';
    }

    logs.push({
      timestamp: timestamp.toISOString(),
      service,
      host,
      level,
      message,
      traceId: `trace-${randomBetween(1000, 9999)}`,
      requestId: `req-${Date.now()}-${i}`,
    });
  }

  return logs;
}

// ── Generate Metric Data Points (100+) ────────────────────────────────────────

function generateMetrics() {
  const metrics = [];

  // 5 metrics × 24 time intervals = 120 data points
  for (const metric of METRICS) {
    for (let i = 0; i < 24; i++) {
      const minutesAgo = i * 5; // every 5 minutes over 2 hours
      const timestamp = generateTimestamp(minutesAgo);
      const service = randomChoice(SERVICES);

      let value;
      switch (metric) {
        case 'cpu_utilization':
          // Simulate a spike around 30-45 min ago
          value = (minutesAgo >= 30 && minutesAgo <= 45)
            ? randomBetween(75, 98)
            : randomBetween(20, 55);
          break;
        case 'memory_usage_mb':
          value = (minutesAgo >= 25 && minutesAgo <= 50)
            ? randomBetween(3500, 4096)
            : randomBetween(1800, 2800);
          break;
        case 'request_latency_ms':
          value = (minutesAgo >= 30 && minutesAgo <= 45)
            ? randomBetween(2000, 5500)
            : randomBetween(50, 250);
          break;
        case 'active_connections':
          value = (minutesAgo >= 20 && minutesAgo <= 40)
            ? randomBetween(800, 1200)
            : randomBetween(100, 400);
          break;
        case 'error_rate_pct':
          value = (minutesAgo >= 30 && minutesAgo <= 45)
            ? randomBetween(15, 45)
            : randomBetween(0, 3);
          break;
        default:
          value = randomBetween(10, 100);
      }

      metrics.push({
        timestamp: timestamp.toISOString(),
        metric_name: metric,
        value,
        unit: metric.includes('pct') ? 'percent' : metric.includes('mb') ? 'MB' : metric.includes('ms') ? 'ms' : 'count',
        service,
        host: randomChoice(HOSTS),
      });
    }
  }

  return metrics;
}

// ── Generate Trace Spans (20+) ────────────────────────────────────────────────

function generateTraces() {
  const traces = [];

  // 5 traces with 4 spans each = 20 spans
  for (let t = 0; t < 5; t++) {
    const traceId = `trace-ext-${Date.now()}-${t}`;
    const minutesAgo = randomBetween(5, 90);
    const baseTime = generateTimestamp(minutesAgo);
    const isSlowTrace = t < 2; // First 2 traces are slow (incident-related)

    const spans = [
      {
        spanId: `span-${t}-1`,
        parentSpanId: null,
        service: 'checkout-service',
        operation: 'POST /api/checkout',
        durationMs: isSlowTrace ? randomBetween(3000, 5500) : randomBetween(80, 200),
        status: isSlowTrace ? 'error' : 'ok',
        startTime: baseTime.toISOString(),
      },
      {
        spanId: `span-${t}-2`,
        parentSpanId: `span-${t}-1`,
        service: 'payment-api',
        operation: 'POST /api/payment/charge',
        durationMs: isSlowTrace ? randomBetween(2000, 4000) : randomBetween(40, 120),
        status: isSlowTrace ? 'error' : 'ok',
        startTime: new Date(baseTime.getTime() + 50).toISOString(),
      },
      {
        spanId: `span-${t}-3`,
        parentSpanId: `span-${t}-1`,
        service: 'inventory-service',
        operation: 'GET /api/inventory/reserve',
        durationMs: isSlowTrace ? randomBetween(1500, 3000) : randomBetween(20, 80),
        status: 'ok',
        startTime: new Date(baseTime.getTime() + 100).toISOString(),
      },
      {
        spanId: `span-${t}-4`,
        parentSpanId: `span-${t}-2`,
        service: 'notification-service',
        operation: 'POST /api/notify/email',
        durationMs: randomBetween(100, 500),
        status: 'ok',
        startTime: new Date(baseTime.getTime() + 200).toISOString(),
      },
    ];

    for (const span of spans) {
      traces.push({
        traceId,
        ...span,
        tags: {
          environment: 'production',
          version: isSlowTrace ? 'v2.4.1' : 'v2.4.0',
        },
      });
    }
  }

  return traces;
}

// ── Generate Deployment Events (3) ────────────────────────────────────────────

function generateDeployments() {
  return [
    {
      timestamp: generateTimestamp(90).toISOString(),
      service: 'checkout-service',
      version: 'v2.4.0',
      previousVersion: 'v2.3.9',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'Routine dependency updates and minor bug fixes',
      status: 'success',
    },
    {
      timestamp: generateTimestamp(45).toISOString(),
      service: 'payment-api',
      version: 'v2.4.1',
      previousVersion: 'v2.4.0',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'New payment provider integration with updated connection pooling',
      status: 'success',
    },
    {
      timestamp: generateTimestamp(30).toISOString(),
      service: 'checkout-service',
      version: 'v2.4.1',
      previousVersion: 'v2.4.0',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'Hotfix: increased timeout for payment-api calls, updated retry logic',
      status: 'success',
    },
  ];
}

// ── HEC Sender ────────────────────────────────────────────────────────────────

function sendBatch(events) {
  return new Promise((resolve, reject) => {
    const payload = events.map(e => JSON.stringify(e)).join('\n');

    const options = {
      hostname: HEC_HOST,
      port: HEC_PORT,
      path: '/services/collector/event',
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Splunk ${HEC_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Splunk-Request-Channel': 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HEC returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SignalSage Extended Data Ingestion ===\n');
  console.log(`Target: https://${HEC_HOST}:${HEC_PORT}`);
  console.log(`Index: ${INDEX}`);
  console.log(`Timestamp range: last 2 hours from now\n`);

  let totalEvents = 0;

  // 1. Ingest logs (55 entries)
  const logs = generateLogs();
  console.log(`Generating ${logs.length} log entries...`);
  const logEvents = logs.map(log => ({
    time: new Date(log.timestamp).getTime() / 1000,
    index: INDEX,
    sourcetype: 'app_logs',
    source: log.service,
    host: log.host,
    event: log,
  }));
  await sendBatch(logEvents);
  totalEvents += logEvents.length;
  console.log(`  ✓ ${logEvents.length} log events ingested`);

  // 2. Ingest metrics (120 data points)
  const metrics = generateMetrics();
  console.log(`Generating ${metrics.length} metric data points...`);
  const metricEvents = metrics.map(m => ({
    time: new Date(m.timestamp).getTime() / 1000,
    index: INDEX,
    sourcetype: 'app_metrics',
    source: m.service,
    host: m.host,
    event: m,
  }));
  await sendBatch(metricEvents);
  totalEvents += metricEvents.length;
  console.log(`  ✓ ${metricEvents.length} metric events ingested`);

  // 3. Ingest traces (20 spans)
  const traces = generateTraces();
  console.log(`Generating ${traces.length} trace spans...`);
  const traceEvents = traces.map(span => ({
    time: new Date(span.startTime).getTime() / 1000,
    index: INDEX,
    sourcetype: 'app_traces',
    source: span.service,
    host: randomChoice(HOSTS),
    event: span,
  }));
  await sendBatch(traceEvents);
  totalEvents += traceEvents.length;
  console.log(`  ✓ ${traceEvents.length} trace span events ingested`);

  // 4. Ingest deployments (3 events)
  const deployments = generateDeployments();
  console.log(`Generating ${deployments.length} deployment events...`);
  const deployEvents = deployments.map(dep => ({
    time: new Date(dep.timestamp).getTime() / 1000,
    index: INDEX,
    sourcetype: 'deployment',
    source: dep.service,
    host: 'ci-server',
    event: dep,
  }));
  await sendBatch(deployEvents);
  totalEvents += deployEvents.length;
  console.log(`  ✓ ${deployEvents.length} deployment events ingested`);

  console.log(`\n=== Done! ${totalEvents} total events ingested ===`);
  console.log('\nData summary:');
  console.log(`  • ${logs.length} log entries (ERROR, WARN, INFO, DEBUG across 5 services)`);
  console.log(`  • ${metrics.length} metric data points (5 metrics × 24 intervals)`);
  console.log(`  • ${traces.length} trace spans (5 traces × 4 spans each)`);
  console.log(`  • ${deployments.length} deployment events (sequence of deploys)`);
  console.log('\nAll timestamps are within the last 2 hours — data is always fresh!');
  console.log('Run with ALLOW_LIVE_SPL=true to query this data in SignalSage.');
}

main().catch((err) => {
  console.error('\nFailed to ingest data:', err.message);
  console.error('Check SPLUNK_HEC_TOKEN in .env.local and ensure Splunk HEC is enabled.');
  process.exit(1);
});
