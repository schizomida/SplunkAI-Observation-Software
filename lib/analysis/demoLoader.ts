import type { EvidenceItem, Incident } from '@/types/index';

import incidentsData from '@/data/demo/incidents.json';
import logsData from '@/data/demo/logs.json';
import metricsData from '@/data/demo/metrics.json';
import tracesData from '@/data/demo/traces.json';
import deploymentsData from '@/data/demo/deployments.json';

/**
 * Returns the first incident from the demo incidents fixture.
 */
export function loadDemoIncident(): Incident {
  const raw = incidentsData[0];
  return {
    id: raw.id,
    title: raw.title,
    service: raw.service,
    severity: raw.severity as Incident['severity'],
    startTime: raw.startTime,
    endTime: raw.endTime,
    mode: raw.mode as Incident['mode'],
    description: raw.description,
  };
}

/**
 * Converts all demo fixture data into a flat array of typed EvidenceItem objects.
 *
 * - Each log entry  → type='log'
 * - Each metric series → type='metric'
 * - Each trace       → type='trace'
 * - Each deployment  → type='deployment'
 */
export function loadDemoEvidence(): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  // ── Logs ──────────────────────────────────────────────────────────────────
  logsData.forEach((log, index) => {
    evidence.push({
      id: `log-${index + 1}`,
      type: 'log',
      timestamp: log.timestamp,
      source: log.service,
      data: log,
      summary: `[${log.level}] ${log.service}: ${log.message}`,
    });
  });

  // ── Metrics ───────────────────────────────────────────────────────────────
  metricsData.forEach((series, index) => {
    // Use the timestamp of the first data point as the representative timestamp.
    const firstPoint = series.dataPoints[0];
    const timestamp = firstPoint ? firstPoint.timestamp : new Date().toISOString();

    evidence.push({
      id: `metric-${index + 1}`,
      type: 'metric',
      timestamp,
      source: series.service,
      data: series,
      summary: `Metric series "${series.name}" (${series.unit}) for ${series.service} — ${series.dataPoints.length} data points`,
    });
  });

  // ── Traces ────────────────────────────────────────────────────────────────
  tracesData.forEach((trace, index) => {
    const rootSpanData = trace.spans.find((s) => s.parentSpanId === null);
    const timestamp = rootSpanData ? rootSpanData.startTime : new Date().toISOString();
    const spanCount = trace.spans.length;
    const errorSpans = trace.spans.filter(
      (s) => s.status === 'error' || s.status === 'timeout'
    ).length;

    evidence.push({
      id: `trace-${index + 1}`,
      type: 'trace',
      timestamp,
      source: trace.rootSpan,
      data: trace,
      summary: `Trace ${trace.traceId} — ${spanCount} spans, ${errorSpans} error/timeout span(s) rooted at ${trace.rootSpan}`,
    });
  });

  // ── Deployments ───────────────────────────────────────────────────────────
  deploymentsData.forEach((deployment, index) => {
    evidence.push({
      id: `deployment-${index + 1}`,
      type: 'deployment',
      timestamp: deployment.timestamp,
      source: deployment.service,
      data: deployment,
      summary: `Deployment of ${deployment.service} ${deployment.version} (prev: ${deployment.previousVersion}) to ${deployment.environment} by ${deployment.deployedBy}`,
    });
  });

  return evidence;
}
