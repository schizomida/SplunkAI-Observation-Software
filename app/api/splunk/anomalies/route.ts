import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * GET /api/splunk/anomalies
 *
 * Proactive anomaly detection endpoint. Runs two queries:
 * 1. Z-score anomaly detection across metrics in last 5 minutes
 * 2. Error rate spike detection in last 5 minutes
 *
 * Returns anomalies, error spikes, and an overall alertLevel.
 */

interface AnomalyEntry {
  service: string;
  anomalyCount: number;
  maxZScore: number;
  affectedMetrics: string;
}

interface ErrorSpike {
  service: string;
  errorCount: number;
}

type AlertLevel = 'normal' | 'warning' | 'critical';

export async function GET() {
  const config = getSplunkConfig();

  if (!isConfigured(config)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Splunk is not configured. Set SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.',
        anomalies: [],
        errorSpikes: [],
        alertLevel: 'normal' as AlertLevel,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    // Query 1: Z-score anomaly detection
    const anomalySpl = `index=main earliest=-5m | eval metric_value=value | eventstats avg(metric_value) as avg_val stdev(metric_value) as stdev_val by metric_name | eval z_score=abs((metric_value - avg_val) / if(stdev_val=0,1,stdev_val)) | where z_score > 2 | stats count as anomaly_count max(z_score) as max_zscore values(metric_name) as affected_metrics by service | where anomaly_count > 0 | sort -max_zscore | head 10`;

    // Query 2: Error rate check
    const errorSpl = `index=main level=ERROR earliest=-5m | stats count as error_count by service | where error_count > 3 | sort -error_count`;

    // Run both queries in parallel
    const [anomalyResults, errorResults] = await Promise.all([
      runQuery(anomalySpl, config),
      runQuery(errorSpl, config),
    ]);

    // Parse anomaly results
    const anomalies: AnomalyEntry[] = (anomalyResults as Record<string, unknown>[]).map((row) => ({
      service: String(row.service || 'unknown'),
      anomalyCount: Number(row.anomaly_count) || 0,
      maxZScore: parseFloat(String(row.max_zscore)) || 0,
      affectedMetrics: Array.isArray(row.affected_metrics)
        ? (row.affected_metrics as string[]).join(', ')
        : String(row.affected_metrics || ''),
    }));

    // Parse error spike results
    const errorSpikes: ErrorSpike[] = (errorResults as Record<string, unknown>[]).map((row) => ({
      service: String(row.service || 'unknown'),
      errorCount: Number(row.error_count) || 0,
    }));

    // Determine alert level
    let alertLevel: AlertLevel = 'normal';

    const maxZScore = anomalies.length > 0
      ? Math.max(...anomalies.map((a) => a.maxZScore))
      : 0;
    const maxErrorCount = errorSpikes.length > 0
      ? Math.max(...errorSpikes.map((e) => e.errorCount))
      : 0;

    if (maxZScore > 4 || maxErrorCount > 10) {
      alertLevel = 'critical';
    } else if (maxZScore > 2 || maxErrorCount > 3) {
      alertLevel = 'warning';
    }

    return NextResponse.json(
      {
        success: true,
        anomalies,
        errorSpikes,
        alertLevel,
        timestamp: new Date().toISOString(),
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Anomaly detection query failed',
        anomalies: [],
        errorSpikes: [],
        alertLevel: 'normal' as AlertLevel,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
