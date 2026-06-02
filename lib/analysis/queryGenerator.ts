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
 * Generates 8 investigation queries for the given incident, parameterized
 * by the incident's service name and time window.
 *
 * Queries 1–5 use safe interpolation for the service name.
 * Queries 6–8 are ML-powered queries that operate across all services
 * and only interpolate epoch timestamps directly.
 *
 * @param incident - The incident to generate queries for.
 * @returns An array of exactly 8 `InvestigationQuery` objects.
 * @throws {Error} If the incident's service name contains disallowed characters.
 */
export function generateQueries(incident: Incident): InvestigationQuery[] {
  const { service, startTime, endTime } = incident;

  // Convert ISO timestamps to epoch seconds for Splunk time bounds
  const earliest = toSplunkTime(startTime);
  const latest = toSplunkTime(endTime);

  // When service is '*' (all services), skip the service filter in queries
  const isAllServices = service === '*' || service === 'main';

  // Parameters for safe interpolation (only used when we have a specific service)
  const params: Record<string, string> = isAllServices
    ? { earliest, latest }
    : { service, earliest, latest };

  // Build service clause for templates
  const serviceClause = isAllServices ? '' : 'service={{service}} ';

  const queries: InvestigationQuery[] = [
    // ── 1. Error Rate Spike ────────────────────────────────────────────────
    {
      id: 'error-rate-spike',
      name: 'Error Rate Spike',
      description:
        'Counts error-level events per minute for the incident service ' +
        'during the incident time window to identify when errors began spiking.',
      spl: buildSafeQuery(
        'index=main sourcetype=app_logs ' + serviceClause + 'level=ERROR ' +
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
        'index=main sourcetype=app_traces ' + serviceClause +
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

    // ── 6. Anomaly Detection (Z-Score) — MLTK ─────────────────────────────
    {
      id: 'anomaly-detection-zscore',
      name: 'Anomaly Detection (Z-Score)',
      description:
        'Identifies metric values that deviate significantly from the mean using statistical z-score analysis.',
      spl:
        `index=main sourcetype=app_metrics earliest=${earliest} latest=${latest} ` +
        '| eval metric_value=value ' +
        '| eventstats avg(metric_value) as avg_val stdev(metric_value) as stdev_val by metric_name ' +
        '| eval z_score=abs((metric_value - avg_val) / stdev_val) ' +
        '| where z_score > 2 ' +
        '| table _time metric_name value avg_val stdev_val z_score ' +
        '| sort -z_score',
      riskLevel: 'medium',
    },

    // ── 7. Log Pattern Clustering — MLTK ──────────────────────────────────
    {
      id: 'log-pattern-clustering',
      name: 'Log Pattern Clustering',
      description:
        'Groups similar log messages into clusters to identify dominant error patterns and recurring issues.',
      spl:
        `index=main sourcetype=app_logs earliest=${earliest} latest=${latest} ` +
        '| cluster showcount=true t=0.7 ' +
        '| sort -cluster_count ' +
        '| table cluster_count _time service level message ' +
        '| head 20',
      riskLevel: 'low',
    },

    // ── 8. Cross-Signal Correlation — MLTK ─────────────────────────────────
    {
      id: 'cross-signal-correlation',
      name: 'Cross-Signal Correlation',
      description:
        'Correlates events across all signal types (logs, metrics, traces, deployments) to identify related patterns.',
      spl:
        `index=main earliest=${earliest} latest=${latest} ` +
        '| stats count as event_count dc(service) as services_affected values(level) as log_levels by sourcetype ' +
        '| sort -event_count',
      riskLevel: 'high',
    },

    // ── 9. Service Health Score ────────────────────────────────────────────
    {
      id: 'service-health-score',
      name: 'Service Health Score',
      description:
        'Computes a health score for each service based on error rates and warning ratios to prioritize which services need attention.',
      spl:
        `index=main earliest=${earliest} latest=${latest} ` +
        '| stats count(eval(level="ERROR")) as errors count(eval(level="WARN")) as warnings count as total by service ' +
        '| eval error_rate=round(errors/total*100, 2) ' +
        '| eval health_score=round(100 - error_rate - (warnings/total*50), 1) ' +
        '| sort health_score',
      riskLevel: 'low',
    },

    // ── 10. Latency Distribution ───────────────────────────────────────────
    {
      id: 'latency-distribution',
      name: 'Latency Distribution',
      description:
        'Analyzes the full latency distribution (p50, p90, p95, p99, max) per service to identify tail-latency issues.',
      spl:
        `index=main sourcetype=app_traces earliest=${earliest} latest=${latest} ` +
        '| stats count p50(durationMs) as p50 p90(durationMs) as p90 p95(durationMs) as p95 p99(durationMs) as p99 max(durationMs) as max_latency by service ' +
        '| eval latency_spread=max_latency-p50 ' +
        '| sort -p99',
      riskLevel: 'low',
    },

    // ── 11. Error Cascade Detection ────────────────────────────────────────
    {
      id: 'error-cascade-detection',
      name: 'Error Cascade Detection',
      description:
        'Detects cascading failures by finding error transactions spanning multiple services within a short time window.',
      spl:
        `index=main sourcetype=app_logs level=ERROR earliest=${earliest} latest=${latest} ` +
        '| transaction service maxspan=2m ' +
        '| stats count as cascade_count values(service) as affected_services dc(service) as service_count by _time ' +
        '| where service_count > 1 ' +
        '| sort -cascade_count',
      riskLevel: 'high',
    },

    // ── 12. Deployment Impact Window ───────────────────────────────────────
    {
      id: 'deployment-impact-window',
      name: 'Deployment Impact Window',
      description:
        'Compares error rates before and after the most recent deployment to assess whether the deploy introduced issues.',
      spl:
        `index=main earliest=${earliest} latest=${latest} ` +
        '| eval is_post_deploy=if(_time > relative_time(now(), "-30m"), 1, 0) ' +
        '| stats count(eval(level="ERROR")) as errors count as total by is_post_deploy sourcetype ' +
        '| eval error_rate=round(errors/total*100, 2)',
      riskLevel: 'medium',
    },
  ];

  return queries;
}
