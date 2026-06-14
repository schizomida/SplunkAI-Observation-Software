import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * GET /api/splunk/monitor
 *
 * Returns real-time monitoring metrics and recent events for the Monitor dashboard.
 * Runs two quick queries:
 *   1. Summary metrics (total events, errors, active services, avg latency) over last 5m
 *   2. Recent 20 events sorted by time
 */
export async function GET() {
  const config = getSplunkConfig();

  if (!isConfigured(config)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Splunk is not configured. Set SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.',
        metrics: null,
        recentEvents: null,
      },
      { status: 503 }
    );
  }

  try {
    // Query 1: Summary metrics for the last 5 minutes
    const metricsSpl =
      'index=main earliest=-24h | stats count as total_events count(eval(level="ERROR")) as error_count dc(service) as active_services avg(durationMs) as avg_latency';

    // Query 2: Recent 20 events
    const eventsSpl =
      'index=main earliest=-24h | sort -_time | head 20 | table _time service level message sourcetype';

    // Run both queries in parallel
    const [metricsResults, eventsResults] = await Promise.all([
      runQuery(metricsSpl, config),
      runQuery(eventsSpl, config),
    ]);

    // Parse metrics from the first result row
    const metricsRow = (metricsResults[0] ?? {}) as Record<string, string>;
    const metrics = {
      totalEvents: parseInt(metricsRow.total_events || '0', 10),
      errorCount: parseInt(metricsRow.error_count || '0', 10),
      activeServices: parseInt(metricsRow.active_services || '0', 10),
      avgLatency: parseFloat(metricsRow.avg_latency || '0'),
    };

    // Parse recent events
    const recentEvents = (eventsResults as Record<string, string>[]).map((row) => ({
      _time: row._time || '',
      service: row.service || '',
      level: row.level || '',
      message: row.message || '',
      sourcetype: row.sourcetype || '',
    }));

    return NextResponse.json(
      {
        success: true,
        metrics,
        recentEvents,
        timestamp: new Date().toISOString(),
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Monitor query failed',
        metrics: null,
        recentEvents: null,
      },
      { status: 500 }
    );
  }
}
