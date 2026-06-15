/**
 * Ingest Realistic Demo Data into Splunk via HTTP Event Collector (HEC)
 *
 * This script generates and sends a comprehensive dataset into Splunk
 * for use with SignalSage. All data is generated dynamically with
 * timestamps relative to "now" so it's always fresh.
 *
 * Data generated:
 *   - 80+ log entries (ERROR, WARN, INFO across 7 services)
 *   - 150+ metric data points (latency, CPU, memory, connections, errors)
 *   - 30+ trace spans (distributed request flows)
 *   - 5 deployment events (rolling deploy scenario)
 *
 * Prerequisites:
 *   1. Splunk Enterprise running locally
 *   2. HEC enabled (Settings → Data Inputs → HTTP Event Collector)
 *   3. A HEC token created with indexer acknowledgment enabled
 *   4. .env.local configured with SPLUNK_HEC_TOKEN and SPLUNK_HEC_PORT
 *
 * Usage:
 *   node scripts/ingest-demo-data.js
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
  console.error('ERROR: SPLUNK_HEC_TOKEN is not set.');
  console.error('');
  console.error('To fix this:');
  console.error('  1. Open Splunk Web at http://localhost:8000');
  console.error('  2. Go to Settings > Data Inputs > HTTP Event Collector');
  console.error('  3. Create a new token (or copy an existing one)');
  console.error('  4. Add SPLUNK_HEC_TOKEN=<your-token> to .env.local');
  console.error('');
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Data Generation ───────────────────────────────────────────────────────────

const SERVICES = [
  'checkout-service',
  'payment-api',
  'payment-service',
  'inventory-service',
  'user-auth',
  'notification-service',
  'order-confirmation-service',
];

const HOSTS = [
  'prod-web-01', 'prod-web-02', 'prod-web-03',
  'prod-api-01', 'prod-api-02',
  'prod-worker-01', 'prod-worker-02',
];

const ERROR_MESSAGES = [
  'Connection timeout to downstream service after 5000ms',
  'Database query exceeded threshold: SELECT orders took 8200ms',
  'Circuit breaker OPEN for payment-api (5 failures in 10s)',
  'Out of memory: heap allocation failed at 4096MB limit',
  'TLS handshake timeout after 30s connecting to redis-cluster',
  'Rate limit exceeded: 429 Too Many Requests from client 10.0.2.15',
  'NullPointerException in OrderProcessor.validatePayment()',
  'Redis connection pool exhausted: 50/50 connections in use',
  'gRPC deadline exceeded for inventory.ReserveStock RPC',
  'Kafka consumer lag exceeding 15000 messages on topic orders.created',
  'Socket connection reset by peer: payment-gateway:443',
  'Deadlock detected in transaction: orders.update',
];

const WARN_MESSAGES = [
  'Connection pool utilization at 87% (threshold: 90%)',
  'Response time degradation: p99 = 2340ms (baseline: 180ms)',
  'Retry attempt 3/5 for POST /api/payment/charge',
  'Memory usage approaching threshold: 93% of 4096MB',
  'Slow database query detected: inventory lookup took 3200ms',
  'TLS certificate expiring in 7 days for *.payment-api.internal',
  'Thread pool saturation: 48/50 threads active',
  'Cache miss rate elevated: 42% (baseline: 8%)',
  'Disk I/O latency spike: 45ms avg (baseline: 2ms)',
  'DNS resolution slow: 800ms for redis-primary.internal',
];

const INFO_MESSAGES = [
  'Request processed successfully in 85ms',
  'Health check passed: all dependencies healthy',
  'Cache refreshed for product catalog (1250 items)',
  'Batch job completed: 3500 order records processed in 12s',
  'Connection established to database cluster (3 nodes)',
  'Feature flag "new-checkout-flow" enabled for 15% of traffic',
  'Metrics flush completed: 450 data points exported',
  'Session cleanup: removed 890 expired sessions',
  'Auto-scaling triggered: 3 -> 5 instances for checkout-service',
  'Deployment webhook received: payment-api v2.4.2',
  'Circuit breaker CLOSED: payment-api recovered',
  'Load balancer health check passed for all 5 backends',
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function minutesAgoTimestamp(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

// ── Generate Logs ─────────────────────────────────────────────────────────────

function generateLogs() {
  const logs = [];
  const levels = ['ERROR', 'ERROR', 'WARN', 'WARN', 'WARN', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO'];

  for (let i = 0; i < 80; i++) {
    const minutesAgo = randomBetween(1, 180);
    const level = randomChoice(levels);
    const service = randomChoice(SERVICES);

    let message;
    if (level === 'ERROR') message = randomChoice(ERROR_MESSAGES);
    else if (level === 'WARN') message = randomChoice(WARN_MESSAGES);
    else message = randomChoice(INFO_MESSAGES);

    logs.push({
      timestamp: minutesAgoTimestamp(minutesAgo).toISOString(),
      service,
      host: randomChoice(HOSTS),
      level,
      message,
      traceId: `trace-${randomBetween(10000, 99999)}`,
      requestId: `req-${Date.now()}-${i}`,
      severity: level === 'ERROR' ? 'high' : level === 'WARN' ? 'medium' : 'low',
    });
  }

  return logs;
}

// ── Generate Metrics ──────────────────────────────────────────────────────────

function generateMetrics() {
  const metrics = [];
  const metricDefs = [
    { name: 'request_latency_ms', unit: 'ms', baseline: [50, 200], spike: [2000, 6000] },
    { name: 'cpu_utilization', unit: 'percent', baseline: [15, 45], spike: [75, 98] },
    { name: 'memory_usage_mb', unit: 'MB', baseline: [1500, 2500], spike: [3500, 4096] },
    { name: 'active_connections', unit: 'count', baseline: [80, 300], spike: [800, 1200] },
    { name: 'error_rate_pct', unit: 'percent', baseline: [0, 2], spike: [12, 45] },
    { name: 'redis_pool_utilization', unit: 'percent', baseline: [20, 50], spike: [85, 100] },
  ];

  // Simulate a spike window 30-60 minutes ago
  const spikeStart = 60;
  const spikeEnd = 30;

  for (const def of metricDefs) {
    for (let i = 0; i < 30; i++) {
      const minutesAgo = i * 6; // every 6 min over 3 hours
      const inSpike = minutesAgo >= spikeEnd && minutesAgo <= spikeStart;
      const value = inSpike
        ? randomBetween(def.spike[0], def.spike[1])
        : randomBetween(def.baseline[0], def.baseline[1]);

      metrics.push({
        timestamp: minutesAgoTimestamp(minutesAgo).toISOString(),
        metric_name: def.name,
        value,
        unit: def.unit,
        service: randomChoice(SERVICES),
        host: randomChoice(HOSTS),
      });
    }
  }

  return metrics;
}

// ── Generate Traces ───────────────────────────────────────────────────────────

function generateTraces() {
  const traces = [];

  for (let t = 0; t < 8; t++) {
    const traceId = `trace-demo-${Date.now()}-${t}`;
    const minutesAgo = randomBetween(5, 120);
    const baseTime = minutesAgoTimestamp(minutesAgo);
    const isSlow = t < 3; // first 3 traces show latency issues

    const spans = [
      {
        spanId: `span-${t}-root`,
        parentSpanId: null,
        service: 'checkout-service',
        operation: 'POST /api/checkout',
        durationMs: isSlow ? randomBetween(3000, 6000) : randomBetween(80, 200),
        status: isSlow ? 'error' : 'ok',
        startTime: baseTime.toISOString(),
      },
      {
        spanId: `span-${t}-payment`,
        parentSpanId: `span-${t}-root`,
        service: 'payment-api',
        operation: 'POST /api/payment/charge',
        durationMs: isSlow ? randomBetween(2500, 4500) : randomBetween(40, 120),
        status: isSlow ? 'error' : 'ok',
        startTime: new Date(baseTime.getTime() + 20).toISOString(),
      },
      {
        spanId: `span-${t}-inventory`,
        parentSpanId: `span-${t}-root`,
        service: 'inventory-service',
        operation: 'GET /api/inventory/reserve',
        durationMs: isSlow ? randomBetween(1500, 3000) : randomBetween(15, 60),
        status: 'ok',
        startTime: new Date(baseTime.getTime() + 50).toISOString(),
      },
      {
        spanId: `span-${t}-notify`,
        parentSpanId: `span-${t}-payment`,
        service: 'notification-service',
        operation: 'POST /api/notify/confirmation',
        durationMs: randomBetween(50, 300),
        status: 'ok',
        startTime: new Date(baseTime.getTime() + 100).toISOString(),
      },
    ];

    for (const span of spans) {
      traces.push({
        traceId,
        ...span,
        tags: {
          environment: 'production',
          version: isSlow ? 'v2.4.1' : 'v2.4.0',
          region: 'us-west-2',
        },
      });
    }
  }

  return traces;
}

// ── Generate Deployments ──────────────────────────────────────────────────────

function generateDeployments() {
  return [
    {
      timestamp: minutesAgoTimestamp(150).toISOString(),
      service: 'checkout-service',
      version: 'v2.3.9',
      previousVersion: 'v2.3.8',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'Routine dependency updates and security patches',
      status: 'success',
    },
    {
      timestamp: minutesAgoTimestamp(90).toISOString(),
      service: 'payment-api',
      version: 'v2.4.0',
      previousVersion: 'v2.3.9',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'Updated Redis connection pooling configuration',
      status: 'success',
    },
    {
      timestamp: minutesAgoTimestamp(55).toISOString(),
      service: 'payment-api',
      version: 'v2.4.1',
      previousVersion: 'v2.4.0',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'New payment provider integration with updated timeout logic',
      status: 'success',
    },
    {
      timestamp: minutesAgoTimestamp(35).toISOString(),
      service: 'checkout-service',
      version: 'v2.4.1',
      previousVersion: 'v2.3.9',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'Hotfix: increased timeout for payment-api calls, updated retry logic',
      status: 'success',
    },
    {
      timestamp: minutesAgoTimestamp(10).toISOString(),
      service: 'notification-service',
      version: 'v1.8.2',
      previousVersion: 'v1.8.1',
      environment: 'production',
      deployedBy: 'ci-pipeline',
      changeDescription: 'Added email delivery retry with exponential backoff',
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
        'X-Splunk-Request-Channel': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
  console.log('=== SignalSage Data Ingestion ===\n');
  console.log(`Target: https://${HEC_HOST}:${HEC_PORT}`);
  console.log(`Index: ${INDEX}`);
  console.log(`Timestamp range: last 3 hours from now\n`);

  let totalEvents = 0;

  // 1. Logs
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
  console.log(`  Done: ${logEvents.length} log events ingested`);

  // 2. Metrics
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
  console.log(`  Done: ${metricEvents.length} metric events ingested`);

  // 3. Traces
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
  console.log(`  Done: ${traceEvents.length} trace span events ingested`);

  // 4. Deployments
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
  console.log(`  Done: ${deployEvents.length} deployment events ingested`);

  console.log(`\n=== Complete! ${totalEvents} total events ingested into index="${INDEX}" ===`);
  console.log('\nSourcetypes created:');
  console.log('  - app_logs       (application log entries with severity)');
  console.log('  - app_metrics    (time-series metric data points)');
  console.log('  - app_traces     (distributed trace spans)');
  console.log('  - deployment     (CI/CD deployment events)');
  console.log('\nAll timestamps are within the last 3 hours. Data is always fresh.');
  console.log('SignalSage is configured to query this data with ALLOW_LIVE_SPL=true.');
}

main().catch((err) => {
  console.error('\nFailed to ingest data:', err.message);
  console.error('');
  console.error('Common issues:');
  console.error('  - HEC not enabled: Settings > Data Inputs > HTTP Event Collector > Global Settings > Enable');
  console.error('  - Wrong token: Check SPLUNK_HEC_TOKEN in .env.local');
  console.error('  - Wrong port: Default HEC port is 8088 (check SPLUNK_HEC_PORT)');
  console.error('  - Splunk not running: Verify at http://localhost:8000');
  process.exit(1);
});
