'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { playErrorSound } from '@/lib/sounds';

type AlertLevel = 'normal' | 'warning' | 'critical';

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

interface AnomalyData {
  anomalies: AnomalyEntry[];
  errorSpikes: ErrorSpike[];
  alertLevel: AlertLevel;
  timestamp: string;
  error?: string | null;
}

export default function AnomalyAlerts() {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previousLevel, setPreviousLevel] = useState<AlertLevel>('normal');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/splunk/anomalies');
      const json = await res.json();

      if (!mountedRef.current) return;

      const newData: AnomalyData = {
        anomalies: json.anomalies || [],
        errorSpikes: json.errorSpikes || [],
        alertLevel: json.alertLevel || 'normal',
        timestamp: json.timestamp || new Date().toISOString(),
        error: json.error || null,
      };

      // Play alert sound when escalating from normal
      if (
        previousLevel === 'normal' &&
        (newData.alertLevel === 'warning' || newData.alertLevel === 'critical')
      ) {
        playErrorSound();
      }

      setPreviousLevel(newData.alertLevel);
      setData(newData);
    } catch {
      if (!mountedRef.current) return;
      setData({
        anomalies: [],
        errorSpikes: [],
        alertLevel: 'normal',
        timestamp: new Date().toISOString(),
        error: 'Failed to fetch anomaly data',
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [previousLevel]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAnomalies();
    intervalRef.current = setInterval(fetchAnomalies, 15000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAnomalies]);

  const alertLevel = data?.alertLevel || 'normal';

  function getBadgeColor(): string {
    switch (alertLevel) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-emerald-500';
    }
  }

  function getBadgeAnimation(): string {
    switch (alertLevel) {
      case 'critical':
        return 'animate-shake';
      case 'warning':
        return '';
      default:
        return 'animate-pulse';
    }
  }

  function getSeverityLabel(zScore: number): string {
    if (zScore > 4) return 'Critical';
    if (zScore > 3) return 'High';
    if (zScore > 2) return 'Moderate';
    return 'Low';
  }

  function getSeverityColor(zScore: number): string {
    if (zScore > 4) return 'text-red-400';
    if (zScore > 3) return 'text-orange-400';
    if (zScore > 2) return 'text-yellow-400';
    return 'text-emerald-400';
  }

  // Collapsed floating button
  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setExpanded(true)}
          className={`relative w-12 h-12 rounded-full ${getBadgeColor()} ${getBadgeAnimation()} shadow-lg hover:scale-110 transition-transform flex items-center justify-center group`}
          title={`Alert Level: ${alertLevel}`}
        >
          {/* Pulse ring for normal */}
          {alertLevel === 'normal' && (
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-30 pulse-ring" />
          )}
          {/* Icon */}
          <span className="text-white text-lg relative z-10">
            {alertLevel === 'critical' ? '🚨' : alertLevel === 'warning' ? '⚠️' : '✓'}
          </span>
          {/* Count badge */}
          {(data?.anomalies.length || 0) + (data?.errorSpikes.length || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-[10px] text-white font-bold flex items-center justify-center border-2 border-slate-900">
              {(data?.anomalies.length || 0) + (data?.errorSpikes.length || 0)}
            </span>
          )}
          {/* Loading spinner */}
          {loading && (
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/50 animate-spin" />
          )}
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 max-h-[28rem] overflow-hidden rounded-xl glass-card shadow-2xl animate-scale-in flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${getBadgeColor()} ${alertLevel === 'normal' ? 'animate-pulse' : ''}`} />
          <h3 className="text-sm font-bold text-white">Anomaly Monitor</h3>
          {loading && <span className="animate-spin text-xs text-white/40">⟳</span>}
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Alert Level Banner */}
        <div className={`rounded-lg p-2.5 text-xs font-medium flex items-center gap-2 ${
          alertLevel === 'critical'
            ? 'bg-red-500/15 text-red-300 border border-red-500/30'
            : alertLevel === 'warning'
              ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        }`}>
          <span>{alertLevel === 'critical' ? '🚨' : alertLevel === 'warning' ? '⚠️' : '✅'}</span>
          <span>
            {alertLevel === 'critical'
              ? 'Critical anomalies detected'
              : alertLevel === 'warning'
                ? 'Warnings detected'
                : 'All systems normal'}
          </span>
        </div>

        {/* Error message if Splunk not connected */}
        {data?.error && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2.5">
            <p className="text-[11px] text-yellow-300/80">{data.error}</p>
          </div>
        )}

        {/* Anomalies List */}
        {data && data.anomalies.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Metric Anomalies</p>
            {data.anomalies.map((a, i) => (
              <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{a.service}</span>
                  <span className={`text-[10px] font-bold ${getSeverityColor(a.maxZScore)}`}>
                    {getSeverityLabel(a.maxZScore)} (z={a.maxZScore.toFixed(1)})
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-white/40">Metrics:</span>
                  {a.affectedMetrics.split(', ').map((m, j) => (
                    <span key={j} className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-medium">
                      {m}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-white/30">{a.anomalyCount} anomalous data points</p>
              </div>
            ))}
          </div>
        )}

        {/* Error Spikes List */}
        {data && data.errorSpikes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Error Spikes</p>
            {data.errorSpikes.map((e, i) => (
              <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 flex items-center justify-between">
                <span className="text-xs font-medium text-white">{e.service}</span>
                <span className="text-xs font-bold text-red-400">{e.errorCount} errors</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {data && data.anomalies.length === 0 && data.errorSpikes.length === 0 && !data.error && (
          <div className="text-center py-4">
            <span className="text-2xl">🧘</span>
            <p className="text-xs text-white/40 mt-2">No anomalies in the last 5 minutes</p>
          </div>
        )}

        {/* Timestamp */}
        {data?.timestamp && (
          <p className="text-[10px] text-white/20 text-center pt-2">
            Last checked: {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
