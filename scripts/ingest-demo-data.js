/**
 * Ingest Demo Data into Splunk via HTTP Event Collector (HEC)
 *
 * This script sends all demo fixture data (logs, metrics, traces, deployments)
 * into your local Splunk instance so SignalSage can query it live.
 *
 * Prerequisites:
 *   1. Splunk Enterprise running locally
 *   2. HEC enabled (Settings → Data Inputs → HTTP Event Collector)
 *   3. A HEC token created with indexer acknowledgment enabled
 *   4. .env.local configured with SPLUNK_HEC_TOKEN and SPLUNK_HEC_PORT
 *
 * Usage:
 *   node scripts/ingest-demo-data.js
 *
 * The script reads configuration from .env.local (or environment variables):
 *   SPLUNK_HEC_TOKEN  — Your HEC token (required)
 *   SPLUNK_HEC_PORT   — HEC port (default: 8088)
 *   SPLUNK_HOST       — Splunk host (default: localhost)
 *   SPLUNK_INDEX      — Target index (default: main)
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
  console.error('  2. Go to Settings → Data Inputs → HTTP Event Collector');
  console.error('  3. Create a new token (or copy an existing one)');
  console.error('  4. Add SPLUNK_HEC_TOKEN=<your-token> to .env.local');
  console.error('');
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Load demo data ────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data', 'demo');
const logs = JSON.parse(fs.readFileSync(path.join(dataDir, 'logs.json'), 'utf8'));
const metrics = JSON.parse(fs.readFileSync(path.join(dataDir, 'metrics.json'), 'utf8'));
const traces = JSON.parse(fs.readFileSync(path.join(dataDir, 'traces.json'), 'utf8'));
const deployments = JSON.parse(fs.readFileSync(path.join(dataDir, 'deployments.json'), 'utf8'));

/**
 * Send a batch of events to Splunk HEC
 */
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

async function main() {
  console.log('=== SignalSage Demo Data Ingestion ===\n');
  console.log(`Target: https://${HEC_HOST}:${HEC_PORT}`);
  console.log(`Index: ${INDEX}\n`);

  let totalEvents = 0;

  // 1. Ingest log entries
  console.log(`Ingesting ${logs.length} log entries...`);
  const logEvents = logs.map(log => ({
    time: new Date(log.timestamp).getTime() / 1000,
    sourcetype: 'app_logs',
    source: log.service,
    host: log.host || 'demo-host',
    event: log,
  }));
  await sendBatch(logEvents);
  totalEvents += logEvents.length;
  console.log(`  ✓ ${logEvents.length} log events ingested`);

  // 2. Ingest metric data points
  console.log(`Ingesting ${metrics.length} metric series...`);
  const metricEvents = [];
  for (const series of metrics) {
    for (const point of series.dataPoints) {
      metricEvents.push({
        time: new Date(point.timestamp).getTime() / 1000,
        sourcetype: 'app_metrics',
        source: series.service,
        host: 'demo-host',
        event: {
          metric_name: series.name,
          value: point.value,
          unit: series.unit,
          service: series.service,
          timestamp: point.timestamp,
        },
      });
    }
  }
  await sendBatch(metricEvents);
  totalEvents += metricEvents.length;
  console.log(`  ✓ ${metricEvents.length} metric events ingested`);

  // 3. Ingest trace spans
  console.log(`Ingesting ${traces.length} traces...`);
  const traceEvents = [];
  for (const trace of traces) {
    for (const span of trace.spans) {
      traceEvents.push({
        time: new Date(span.startTime).getTime() / 1000,
        sourcetype: 'app_traces',
        source: span.service,
        host: 'demo-host',
        event: {
          traceId: trace.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          service: span.service,
          operation: span.operation,
          durationMs: span.durationMs,
          status: span.status,
          tags: span.tags,
          timestamp: span.startTime,
        },
      });
    }
  }
  await sendBatch(traceEvents);
  totalEvents += traceEvents.length;
  console.log(`  ✓ ${traceEvents.length} trace span events ingested`);

  // 4. Ingest deployment events
  console.log(`Ingesting ${deployments.length} deployment events...`);
  const deployEvents = deployments.map(dep => ({
    time: new Date(dep.timestamp).getTime() / 1000,
    sourcetype: 'deployment',
    source: dep.service,
    host: 'demo-host',
    event: dep,
  }));
  await sendBatch(deployEvents);
  totalEvents += deployEvents.length;
  console.log(`  ✓ ${deployEvents.length} deployment events ingested`);

  console.log(`\n=== Done! ${totalEvents} total events ingested into index="${INDEX}" ===`);
  console.log('\nSourcetypes created:');
  console.log('  • app_logs     — application log entries');
  console.log('  • app_metrics  — time-series metric data points');
  console.log('  • app_traces   — distributed trace spans');
  console.log('  • deployment   — deployment events');
  console.log('\nYou can now run SignalSage with ALLOW_LIVE_SPL=true to query this data.');
}

main().catch((err) => {
  console.error('\nFailed to ingest data:', err.message);
  console.error('');
  console.error('Common issues:');
  console.error('  • HEC not enabled: Settings → Data Inputs → HTTP Event Collector → Global Settings → Enable');
  console.error('  • Wrong token: Check SPLUNK_HEC_TOKEN in .env.local');
  console.error('  • Wrong port: Default HEC port is 8088 (check SPLUNK_HEC_PORT)');
  console.error('  • Splunk not running: Verify at http://localhost:8000');
  process.exit(1);
});
