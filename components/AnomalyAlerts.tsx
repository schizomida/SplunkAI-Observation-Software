'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AnomalyResult {
  anomalyCount: number;
  affectedMetrics: string[];
  peakZScore: number;
  checkedAt: Date;
  status: 'clear' | 'anomaly' | 'error';
}

export default function AnomalyAlerts() {
  const [current, setCurrent] = useState<AnomalyResult | null>(null);
  const [history, setHistory] = useState<AnomalyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/splunk/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spl: 'index=main sourcetype=app_metrics earliest=-30m | eventstats avg(value) as avg_val stdev(value) as stdev_val by metric_name | eval z_score=abs((value - avg_val) / stdev_val) | where z_score > 2.5 | stats count as anomaly_count values(metric_name) as affected_metrics max(z_score) as peak_zscore',
        }),
      });
      const data = await res.json();

      let result: AnomalyResult;
      if (data.success && data.results && data.results.length > 0) {
        const row = data.results[0] as Record<string, unknown>;
        const count = Number(row.anomaly_count) || 0;
        const metrics = Array.isArray(row.affected_metrics)
          ? (row.affected_metrics as string[])
          : typeof row.affected_metrics === 'string'
            ? [row.affected_metrics]
            : [];
        const zscore = Number(row.peak_zscore) || 0;

        result = {
          anomalyCount: count,
          affectedMetrics: metrics,
          peakZScore: zscore,
          checkedAt: new Date(),
          status: count > 0 ? 'anomaly' : 'clear',
        };
      } else {
        result = {
          anomalyCount: 0,
          affectedMetrics: [],
          peakZScore: 0,
          checkedAt: new Date(),
          status: data.success ? 'clear' : 'error',
        };
      }

      setCurrent(result);
      setHistory(prev => [result, ...prev].slice(0, 5));
    } catch {
      const errorResult: AnomalyResult = {
        anomalyCount: 0,
        affectedMetrics: [],
        peakZScore: 0,
        checkedAt: new Date(),
        status: 'error',
      };
      setCurrent(errorResult);
      setHistory(prev => [errorResult, ...prev].slice(0, 5));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAnomalies();
    intervalRef.current = setInterval(checkAnomalies, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkAnomalies]);

  function statusCard() {
    if (!current) {
      return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
          <p className="text-xs text-white/40">Checking for anomalies...</p>
        </div>
      );
    }

    if (current.status === 'error') {
      return (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-yellow-300">Anomaly Check Unavailable</p>
              <p className="text-xs text-yellow-400/60">Unable to run anomaly detection. Splunk may not be connected.</p>
            </div>
          </div>
        </div>
      );
    }

    if (current.status === 'anomaly') {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 animate-pulse-slow">
          <div className="flex items-start gap-3">
            <span className="text-2xl animate-pulse">🚨</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-300">
                {current.anomalyCount} Anomal{current.anomalyCount === 1 ? 'y' : 'ies'} Detected
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/40">Affected:</span>
                  <div className="flex flex-wrap gap-1">
                    {current.affectedMetrics.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full text-[10px] font-medium">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/40">Peak Z-Score:</span>
                  <span className="text-red-300 font-mono font-bold">{current.peakZScore.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-3">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">All Clear</p>
            <p className="text-xs text-emerald-400/60">No anomalies detected in the last 30 minutes.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <span>🔮</span> Proactive Anomaly Alerting
          {loading && <span className="animate-spin text-xs">⟳</span>}
        </h3>
        <span className="text-[10px] text-white/30">Auto-checks every 30s</span>
      </div>

      {statusCard()}

      {/* Alert History */}
      {history.length > 1 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Recent Checks</p>
          <div className="space-y-1">
            {history.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  h.status === 'anomaly' ? 'bg-red-400' :
                  h.status === 'error' ? 'bg-yellow-400' :
                  'bg-emerald-400'
                }`} />
                <span className="text-white/30 font-mono">{h.checkedAt.toLocaleTimeString()}</span>
                <span className="text-white/50">
                  {h.status === 'anomaly' ? `${h.anomalyCount} anomalies` :
                   h.status === 'error' ? 'Check failed' :
                   'Clear'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
