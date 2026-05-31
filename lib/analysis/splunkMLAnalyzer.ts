/**
 * Splunk ML Analyzer
 *
 * Runs ML-powered analysis queries against Splunk using MLTK capabilities
 * (z-score anomaly detection, log clustering, cross-signal correlation,
 * time-series forecasting, outlier detection, error trend analysis,
 * service dependency mapping, resource saturation scoring, event velocity
 * analysis, and impact radius assessment) and returns structured insights
 * for the investigation pipeline.
 */

import { runQuery } from '@/lib/splunk/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MLInsight {
  type: 'anomaly' | 'cluster' | 'correlation' | 'trend' | 'outlier' | 'saturation' | 'velocity' | 'dependency' | 'impact';
  title: string;
  description: string;
  confidence: number; // 0-1
  data: unknown;
}

// ── Query Builders ────────────────────────────────────────────────────────────

function buildAnomalyDetectionQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_metrics earliest=${earliest} latest=${latest} ` +
    '| eval metric_value=value ' +
    '| eventstats avg(metric_value) as avg_val stdev(metric_value) as stdev_val by metric_name ' +
    '| eval z_score=abs((metric_value - avg_val) / stdev_val) ' +
    '| where z_score > 2 ' +
    '| table _time metric_name value avg_val stdev_val z_score ' +
    '| sort -z_score'
  );
}

function buildClusteringQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_logs earliest=${earliest} latest=${latest} ` +
    '| cluster showcount=true t=0.7 ' +
    '| sort -cluster_count ' +
    '| table cluster_count _time service level message ' +
    '| head 20'
  );
}

function buildCorrelationQuery(earliest: string, latest: string): string {
  return (
    `index=main earliest=${earliest} latest=${latest} ` +
    '| stats count as event_count dc(service) as services_affected values(level) as log_levels by sourcetype ' +
    '| sort -event_count'
  );
}

function buildTimeSeriesForecastQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_metrics earliest=${earliest} latest=${latest} ` +
    '| timechart span=5m avg(value) as avg_value by metric_name ' +
    '| predict avg_value as predicted_value algorithm=LLP5 future_timespan=6 ' +
    '| table _time metric_name avg_value predicted_value ' +
    '| where isnotnull(predicted_value)'
  );
}

function buildOutlierDetectionQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_traces earliest=${earliest} latest=${latest} ` +
    '| eventstats avg(durationMs) as avg_duration stdev(durationMs) as stdev_duration by service ' +
    '| eval is_outlier=if(durationMs > avg_duration + 2*stdev_duration, 1, 0) ' +
    '| where is_outlier=1 ' +
    '| table _time service operation durationMs avg_duration status ' +
    '| sort -durationMs'
  );
}

function buildErrorTrendQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_logs level=ERROR earliest=${earliest} latest=${latest} ` +
    '| timechart span=5m count as error_count ' +
    '| trendline sma2(error_count) as trend ' +
    '| eval trend_direction=if(error_count > trend, "increasing", "decreasing") ' +
    '| table _time error_count trend trend_direction'
  );
}

function buildServiceDependencyQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_traces earliest=${earliest} latest=${latest} ` +
    '| stats count as call_count avg(durationMs) as avg_latency by service operation status ' +
    '| sort -call_count'
  );
}

function buildResourceSaturationQuery(earliest: string, latest: string): string {
  return (
    `index=main sourcetype=app_metrics earliest=${earliest} latest=${latest} ` +
    '| stats max(value) as peak min(value) as trough avg(value) as average by metric_name ' +
    '| eval saturation_pct=round((peak / (average * 2)) * 100, 1) ' +
    '| eval risk=case(saturation_pct > 90, "critical", saturation_pct > 70, "high", saturation_pct > 50, "medium", true(), "low") ' +
    '| sort -saturation_pct'
  );
}

function buildEventVelocityQuery(earliest: string, latest: string): string {
  return (
    `index=main earliest=${earliest} latest=${latest} ` +
    '| timechart span=1m count as events_per_min by sourcetype ' +
    '| eventstats avg(events_per_min) as avg_rate stdev(events_per_min) as stdev_rate ' +
    '| eval velocity_score=round((events_per_min - avg_rate) / stdev_rate, 2) ' +
    '| where velocity_score > 2 ' +
    '| sort -velocity_score'
  );
}

function buildImpactRadiusQuery(earliest: string, latest: string): string {
  return (
    `index=main earliest=${earliest} latest=${latest} ` +
    '| stats dc(service) as unique_services dc(host) as unique_hosts count as total_events values(level) as severity_levels by sourcetype ' +
    '| eval impact_score=unique_services * unique_hosts ' +
    '| sort -impact_score'
  );
}

// ── Result Parsers ────────────────────────────────────────────────────────────

function parseAnomalyResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Find the highest z-score anomaly
  const topResult = results[0] as Record<string, unknown>;
  const zScore = parseFloat(String(topResult?.z_score ?? '0'));
  const metricName = String(topResult?.metric_name ?? 'unknown');

  // Confidence based on z-score magnitude: z=2 → 0.5, z=3 → 0.7, z=4+ → 0.85+
  const confidence = Math.min(0.95, 0.3 + (zScore - 2) * 0.2);

  insights.push({
    type: 'anomaly',
    title: `Metric anomaly detected in ${metricName}`,
    description:
      `${results.length} metric anomalies found. Highest z-score: ${zScore.toFixed(2)} ` +
      `in "${metricName}", indicating values significantly deviating from the mean.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseClusterResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Identify the dominant error pattern (highest cluster_count)
  const topCluster = results[0] as Record<string, unknown>;
  const clusterCount = parseInt(String(topCluster?.cluster_count ?? '0'), 10);
  const message = String(topCluster?.message ?? 'unknown pattern');
  const level = String(topCluster?.level ?? '');
  const service = String(topCluster?.service ?? '');

  // Total events across all clusters
  const totalEvents = results.reduce<number>((sum, r) => {
    const row = r as Record<string, unknown>;
    return sum + parseInt(String(row?.cluster_count ?? '0'), 10);
  }, 0);

  // Confidence based on how dominant the top cluster is
  const dominanceRatio = totalEvents > 0 ? clusterCount / totalEvents : 0;
  const confidence = Math.min(0.9, 0.3 + dominanceRatio * 0.6);

  insights.push({
    type: 'cluster',
    title: `Dominant log pattern: ${level ? `[${level}] ` : ''}${service || 'service'}`,
    description:
      `Top cluster has ${clusterCount} occurrences out of ${totalEvents} total events ` +
      `(${(dominanceRatio * 100).toFixed(0)}% dominance). Pattern: "${message.substring(0, 100)}"`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseCorrelationResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Identify which signal types are most active
  const signalSummary = results.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      sourcetype: String(row?.sourcetype ?? 'unknown'),
      eventCount: parseInt(String(row?.event_count ?? '0'), 10),
      servicesAffected: parseInt(String(row?.services_affected ?? '0'), 10),
      logLevels: row?.log_levels,
    };
  });

  const totalEvents = signalSummary.reduce((sum, s) => sum + s.eventCount, 0);
  const mostActive = signalSummary[0];

  // Check if deployment events exist (indicates deployment correlation)
  const hasDeployments = signalSummary.some(
    (s) => s.sourcetype === 'deployment' && s.eventCount > 0
  );

  // Confidence based on event volume and diversity of signals
  const confidence = Math.min(
    0.85,
    0.3 + (signalSummary.length / 4) * 0.2 + (hasDeployments ? 0.15 : 0)
  );

  insights.push({
    type: 'correlation',
    title: `Cross-signal activity: ${mostActive?.sourcetype ?? 'unknown'} dominant`,
    description:
      `${totalEvents} total events across ${signalSummary.length} signal types. ` +
      `Most active: ${mostActive?.sourcetype} (${mostActive?.eventCount} events, ` +
      `${mostActive?.servicesAffected} services affected).` +
      (hasDeployments ? ' Deployment events detected during incident window.' : ''),
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseForecastResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Look at predicted values to determine trend direction
  const predictions = results.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      time: String(row?._time ?? ''),
      metricName: String(row?.metric_name ?? 'unknown'),
      avgValue: parseFloat(String(row?.avg_value ?? '0')),
      predictedValue: parseFloat(String(row?.predicted_value ?? '0')),
    };
  });

  // Determine if the forecast shows an upward or downward trend
  const lastPrediction = predictions[predictions.length - 1];
  const firstPrediction = predictions[0];
  const trendDirection = lastPrediction && firstPrediction
    ? (lastPrediction.predictedValue > firstPrediction.predictedValue ? 'increasing' : 'decreasing')
    : 'stable';

  const metricName = firstPrediction?.metricName ?? 'unknown';
  const confidence = Math.min(0.8, 0.4 + predictions.length * 0.05);

  insights.push({
    type: 'trend',
    title: `Forecast: ${metricName} trending ${trendDirection}`,
    description:
      `Time-series forecasting (LLP5) predicts ${metricName} is ${trendDirection}. ` +
      `${predictions.length} future data points projected. ` +
      `Latest predicted value: ${lastPrediction?.predictedValue.toFixed(2) ?? 'N/A'}.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseOutlierResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  const topOutlier = results[0] as Record<string, unknown>;
  const duration = parseFloat(String(topOutlier?.durationMs ?? '0'));
  const avgDuration = parseFloat(String(topOutlier?.avg_duration ?? '0'));
  const service = String(topOutlier?.service ?? 'unknown');
  const operation = String(topOutlier?.operation ?? 'unknown');

  // Confidence based on how far the outlier deviates
  const deviationFactor = avgDuration > 0 ? duration / avgDuration : 1;
  const confidence = Math.min(0.9, 0.4 + Math.min(deviationFactor * 0.1, 0.5));

  insights.push({
    type: 'outlier',
    title: `Trace outlier: ${service}/${operation} (${duration.toFixed(0)}ms)`,
    description:
      `${results.length} abnormally slow trace spans detected. ` +
      `Slowest: ${service}/${operation} at ${duration.toFixed(0)}ms ` +
      `(avg: ${avgDuration.toFixed(0)}ms, ${deviationFactor.toFixed(1)}x slower than normal).`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseErrorTrendResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Count increasing vs decreasing intervals
  let increasing = 0;
  let decreasing = 0;
  for (const r of results) {
    const row = r as Record<string, unknown>;
    const direction = String(row?.trend_direction ?? '');
    if (direction === 'increasing') increasing++;
    else if (direction === 'decreasing') decreasing++;
  }

  const total = increasing + decreasing;
  const trendDirection = increasing > decreasing ? 'increasing' : 'decreasing';
  const dominance = total > 0 ? Math.max(increasing, decreasing) / total : 0;
  const confidence = Math.min(0.85, 0.3 + dominance * 0.5);

  insights.push({
    type: 'trend',
    title: `Error rate is ${trendDirection}`,
    description:
      `Error trend analysis shows errors are ${trendDirection} over the incident window. ` +
      `${increasing} intervals with increasing errors, ${decreasing} with decreasing. ` +
      `Trend dominance: ${(dominance * 100).toFixed(0)}%.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseDependencyResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Map service dependencies
  const services = new Set<string>();
  let totalCalls = 0;
  let errorCalls = 0;

  for (const r of results) {
    const row = r as Record<string, unknown>;
    const service = String(row?.service ?? '');
    const status = String(row?.status ?? '');
    const callCount = parseInt(String(row?.call_count ?? '0'), 10);

    if (service) services.add(service);
    totalCalls += callCount;
    if (status === 'error' || status === 'ERROR') errorCalls += callCount;
  }

  const errorRate = totalCalls > 0 ? errorCalls / totalCalls : 0;
  const confidence = Math.min(0.8, 0.3 + services.size * 0.1 + errorRate * 0.3);

  insights.push({
    type: 'dependency',
    title: `Service dependency map: ${services.size} services, ${totalCalls} calls`,
    description:
      `Mapped ${services.size} services with ${totalCalls} total inter-service calls. ` +
      `Error rate across dependencies: ${(errorRate * 100).toFixed(1)}%. ` +
      `Services: ${Array.from(services).slice(0, 5).join(', ')}${services.size > 5 ? '...' : ''}.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseSaturationResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  const topResult = results[0] as Record<string, unknown>;
  const metricName = String(topResult?.metric_name ?? 'unknown');
  const saturationPct = parseFloat(String(topResult?.saturation_pct ?? '0'));
  const risk = String(topResult?.risk ?? 'low');

  // Count critical/high risk resources
  let criticalCount = 0;
  let highCount = 0;
  for (const r of results) {
    const row = r as Record<string, unknown>;
    const rowRisk = String(row?.risk ?? '');
    if (rowRisk === 'critical') criticalCount++;
    else if (rowRisk === 'high') highCount++;
  }

  const confidence = Math.min(0.9, 0.3 + criticalCount * 0.2 + highCount * 0.1);

  insights.push({
    type: 'saturation',
    title: `Resource saturation: ${metricName} at ${saturationPct}% (${risk})`,
    description:
      `${results.length} resources scored for saturation. ` +
      `Highest: ${metricName} at ${saturationPct}% saturation (risk: ${risk}). ` +
      `${criticalCount} critical, ${highCount} high-risk resources detected.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseVelocityResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  const topResult = results[0] as Record<string, unknown>;
  const velocityScore = parseFloat(String(topResult?.velocity_score ?? '0'));

  // Confidence based on velocity score magnitude and number of bursts
  const confidence = Math.min(0.85, 0.3 + Math.min(velocityScore * 0.1, 0.3) + Math.min(results.length * 0.05, 0.25));

  insights.push({
    type: 'velocity',
    title: `Event velocity burst detected (score: ${velocityScore.toFixed(1)})`,
    description:
      `${results.length} event velocity bursts detected (>2σ above normal rate). ` +
      `Peak velocity score: ${velocityScore.toFixed(2)}. ` +
      `These bursts indicate sudden surges in event generation that may correlate with the incident.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

function parseImpactResults(results: unknown[]): MLInsight[] {
  if (!results || results.length === 0) return [];

  const insights: MLInsight[] = [];

  // Calculate total impact across all sourcetypes
  let totalServices = 0;
  let totalHosts = 0;
  let totalEvents = 0;

  for (const r of results) {
    const row = r as Record<string, unknown>;
    totalServices = Math.max(totalServices, parseInt(String(row?.unique_services ?? '0'), 10));
    totalHosts = Math.max(totalHosts, parseInt(String(row?.unique_hosts ?? '0'), 10));
    totalEvents += parseInt(String(row?.total_events ?? '0'), 10);
  }

  const impactScore = totalServices * totalHosts;
  const confidence = Math.min(0.85, 0.3 + Math.min(impactScore * 0.05, 0.4) + Math.min(totalEvents / 1000, 0.15));

  insights.push({
    type: 'impact',
    title: `Impact radius: ${totalServices} services, ${totalHosts} hosts`,
    description:
      `Impact assessment shows ${totalServices} unique services and ${totalHosts} unique hosts affected. ` +
      `Total events: ${totalEvents}. Impact score: ${impactScore}. ` +
      `Higher scores indicate broader blast radius requiring coordinated response.`,
    confidence: Math.max(0, confidence),
    data: results,
  });

  return insights;
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Runs ML-powered analysis queries against Splunk in parallel and returns
 * structured insights sorted by confidence.
 *
 * Runs 10 ML queries in parallel:
 * 1. Anomaly Detection (Z-Score)
 * 2. Log Pattern Clustering
 * 3. Cross-Signal Correlation
 * 4. Time-Series Forecasting
 * 5. Outlier Detection on Traces
 * 6. Error Rate Trend Analysis
 * 7. Service Dependency Mapping
 * 8. Resource Saturation Scoring
 * 9. Event Velocity Analysis
 * 10. Impact Radius Assessment
 *
 * Handles errors gracefully — returns an empty array if Splunk is unavailable.
 *
 * @param earliest - Epoch timestamp string for the start of the analysis window.
 * @param latest - Epoch timestamp string for the end of the analysis window.
 * @returns Array of MLInsight objects sorted by confidence (highest first).
 */
export async function runMLAnalysis(
  earliest: string,
  latest: string
): Promise<MLInsight[]> {
  try {
    // Run all 10 ML queries in parallel
    const [
      anomalyResults,
      clusterResults,
      correlationResults,
      forecastResults,
      outlierResults,
      errorTrendResults,
      dependencyResults,
      saturationResults,
      velocityResults,
      impactResults,
    ] = await Promise.all([
      runQuery(buildAnomalyDetectionQuery(earliest, latest)).catch(() => []),
      runQuery(buildClusteringQuery(earliest, latest)).catch(() => []),
      runQuery(buildCorrelationQuery(earliest, latest)).catch(() => []),
      runQuery(buildTimeSeriesForecastQuery(earliest, latest)).catch(() => []),
      runQuery(buildOutlierDetectionQuery(earliest, latest)).catch(() => []),
      runQuery(buildErrorTrendQuery(earliest, latest)).catch(() => []),
      runQuery(buildServiceDependencyQuery(earliest, latest)).catch(() => []),
      runQuery(buildResourceSaturationQuery(earliest, latest)).catch(() => []),
      runQuery(buildEventVelocityQuery(earliest, latest)).catch(() => []),
      runQuery(buildImpactRadiusQuery(earliest, latest)).catch(() => []),
    ]);

    // Parse results into MLInsight objects
    const insights: MLInsight[] = [
      ...parseAnomalyResults(anomalyResults),
      ...parseClusterResults(clusterResults),
      ...parseCorrelationResults(correlationResults),
      ...parseForecastResults(forecastResults),
      ...parseOutlierResults(outlierResults),
      ...parseErrorTrendResults(errorTrendResults),
      ...parseDependencyResults(dependencyResults),
      ...parseSaturationResults(saturationResults),
      ...parseVelocityResults(velocityResults),
      ...parseImpactResults(impactResults),
    ];

    // Sort by confidence descending
    insights.sort((a, b) => b.confidence - a.confidence);

    return insights;
  } catch (error) {
    console.error(
      '[MLAnalyzer] ML analysis failed:',
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
