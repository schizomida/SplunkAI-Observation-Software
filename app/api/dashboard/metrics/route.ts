import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * GET /api/dashboard/metrics
 *
 * Runs 4 dashboard queries in parallel and returns combined metrics.
 * Returns: { errors, avgLatency, activeServices, eventsPerMin, timestamp, success }
 *
 * Falls back to 0s if Splunk is unavailable.
 */
export async function GET() {
  const config = getSplunkConfig();
  const timestamp = new Date().toISOString();

  // If Splunk isn't configured, return mock/demo data
  if (!isConfigured(config)) {
    return NextResponse.json({
      success: true,
      errors: Math.floor(Math.random() * 15),
      avgLatency: parseFloat((Math.random() * 800 + 50).toFixed(1)),
      activeServices: Math.floor(Math.random() * 4) + 3,
      eventsPerMin: Math.floor(Math.random() * 200) + 50,
      timestamp,
    });
  }

  // Run all 4 queries in parallel against real Splunk
  try {
    const [errorResult, latencyResult, servicesResult, velocityResult] =
      await Promise.allSettled([
        runQuery(
          'index=main sourcetype=app_logs level=ERROR earliest=-5m | stats count as errors',
          config
        ),
        runQuery(
          'index=main sourcetype=app_traces earliest=-5m | stats avg(durationMs) as avg_latency',
          config
        ),
        runQuery(
          'index=main earliest=-5m | stats dc(service) as active_services',
          config
        ),
        runQuery(
          'index=main earliest=-5m | stats count as total | eval epm=total/5',
          config
        ),
      ]);

    // Parse errors
    let errors = 0;
    if (errorResult.status === 'fulfilled' && errorResult.value.length > 0) {
      const row = errorResult.value[0] as Record<string, string>;
      errors = parseInt(row.errors ?? '0', 10);
    }

    // Parse avg latency
    let avgLatency = 0;
    if (latencyResult.status === 'fulfilled' && latencyResult.value.length > 0) {
      const row = latencyResult.value[0] as Record<string, string>;
      avgLatency = parseFloat(row.avg_latency ?? '0');
    }

    // Parse active services
    let activeServices = 0;
    if (servicesResult.status === 'fulfilled' && servicesResult.value.length > 0) {
      const row = servicesResult.value[0] as Record<string, string>;
      activeServices = parseInt(row.active_services ?? '0', 10);
    }

    // Parse events per minute
    let eventsPerMin = 0;
    if (velocityResult.status === 'fulfilled' && velocityResult.value.length > 0) {
      const row = velocityResult.value[0] as Record<string, string>;
      eventsPerMin = parseFloat(row.epm ?? '0');
    }

    return NextResponse.json({
      success: true,
      errors,
      avgLatency,
      activeServices,
      eventsPerMin,
      timestamp,
    });
  } catch (error) {
    // On failure, return 0s gracefully
    return NextResponse.json({
      success: true,
      errors: 0,
      avgLatency: 0,
      activeServices: 0,
      eventsPerMin: 0,
      timestamp,
      warning: error instanceof Error ? error.message : 'Failed to fetch metrics',
    });
  }
}
