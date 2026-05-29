/**
 * SPL Investigation Query Generator
 *
 * Generates a set of parameterized Splunk SPL queries for investigating
 * a given incident. Each query targets a specific investigation angle
 * (error rate, latency, deployments, dependencies, host/pod impact).
 *
 * All service names are safely interpolated via `buildSafeQuery` to
 * prevent SPL injection.
 */

import { Incident, InvestigationQuery } from '@/lib/types';
import { buildSafeQuery } from '@/lib/splunk/queryBuilder';

/**
 * Converts an ISO 8601 timestamp to a Splunk-compatible time string.
 * Splunk accepts ISO format in earliest/latest when quoted, but for
 * maximum compatibility we convert to epoch seconds as a string.
 */
function toSplunkTime(isoTime: string): string {
  const epoch = Math.floor(new Date(isoTime).getTime() / 1000);
  return epoch.toString();
}

/**
 * Generates 5 investigation queries for the given incident, parameterized
 * by the incident's service name and time window.
 *
 * @param incident - The incident to generate queries for.
 * @returns An array of exactly 5 `InvestigationQuery` objects.
 * @throws {Error} If the incident's service name contains disallowed characters.
 */
export function generateQueries(incident: Incident): InvestigationQuery[] {
  const { service, startTime, endTime } = incident;

  // Convert ISO timestamps to epoch seconds for Splunk time bounds
  const earliest = toSplunkTime(startTime);
  const latest = toSplunkTime(endTime);

  // Parameters for safe interpolation
  const params = { service, earliest, latest };

  const queries: InvestigationQuery[] = [
    // ── 1. Error Rate Spike ────────────────────────────────────────────────
    {
      id: 'error-rate-spike',
      name: 'Error Rate Spike',
      description:
        'Counts error-level events per minute for the incident service ' +
        'during the incident time window to identify when errors began spiking.',
      spl: buildSafeQuery(
        'index=main sourcetype=app_logs service={{service}} level=ERROR ' +
          'earliest={{earliest}} latest={{latest}} ' +
          '| timechart span=1m count AS error_count',
        params
      ),
      riskLevel: 'low',
    },

    // ── 2. Latency Percentiles ─────────────────────────────────────────────
    {
      id: 'latency-percentiles',
      name: 'Latency Percentiles',
      description:
        'Computes p50, p95, and p99 response-time percentiles for the ' +
        'incident service to surface tail-latency degradation.',
      spl: buildSafeQuery(
        'index=main sourcetype=app_traces service={{service}} ' +
          'earliest={{earliest}} latest={{latest}} ' +
          '| stats p50(durationMs) AS p50 ' +
          'p95(durationMs) AS p95 ' +
          'p99(durationMs) AS p99 ' +
          'BY service',
        params
      ),
      riskLevel: 'low',
    },

    // ── 3. Deployment Correlation ──────────────────────────────────────────
    {
      id: 'deployment-correlation',
      name: 'Deployment Correlation',
      description:
        'Searches for deployment events near the incident start time to ' +
        'determine whether a recent release triggered the incident.',
      spl: buildSafeQuery(
        'index=main sourcetype=deployment ' +
          'earliest={{earliest}} latest={{latest}} ' +
          '| table _time service version previousVersion environment deployedBy changeDescription ' +
          '| sort _time',
        params
      ),
      riskLevel: 'medium',
    },

    // ── 4. Dependency Timeout ──────────────────────────────────────────────
    {
      id: 'dependency-timeout',
      name: 'Dependency Timeout',
      description:
        'Finds timeout errors in downstream dependencies called by the ' +
        'incident service to identify cascading failure sources.',
      spl: buildSafeQuery(
        'index=main sourcetype=app_logs ' +
          'earliest={{earliest}} latest={{latest}} ' +
          '(*timeout* OR *ETIMEDOUT* OR *connection refused*) ' +
          '| stats count AS timeout_count BY service message ' +
          '| sort -timeout_count',
        params
      ),
      riskLevel: 'medium',
    },

    // ── 5. Host / Pod Impact ───────────────────────────────────────────────
    {
      id: 'host-pod-impact',
      name: 'Host/Pod Impact',
      description:
        'Identifies which hosts or Kubernetes pods are most affected by ' +
        'the incident, ranked by error count, to scope the blast radius.',
      spl: buildSafeQuery(
        'index=main sourcetype=app_logs level=ERROR ' +
          'earliest={{earliest}} latest={{latest}} ' +
          '| stats count AS error_count BY host service ' +
          '| sort -error_count ' +
          '| head 20',
        params
      ),
      riskLevel: 'high',
    },
  ];

  return queries;
}
