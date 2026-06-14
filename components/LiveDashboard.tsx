'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { playClickSound } from '@/lib/sounds';

interface MetricData {
  errors: number;
  avgLatency: number;
  activeServices: number;
  eventsPerMin: number;
  timestamp: string;
}

interface MetricCard {
  label: string;
  value: string;
  icon: string;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
}

export default function LiveDashboard() {
  const [metrics, setMetrics] = useState<MetricCard[]>([
    { label: 'Error Rate', value: '—', icon: 'err', trend: 'stable', status: 'good' },
    { label: 'Avg Latency', value: '—', icon: 'lat', trend: 'stable', status: 'good' },
    { label: 'Active Services', value: '—', icon: 'svc', trend: 'stable', status: 'good' },
    { label: 'Event Velocity', value: '—', icon: 'vel', trend: 'stable', status: 'good' },
  ]);
  const [history, setHistory] = useState<MetricData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const prevMetrics = useRef<MetricData | null>(null);

  function getTrend(current: number, previous: number | undefined): 'up' | 'down' | 'stable' {
    if (previous === undefined) return 'stable';
    const diff = current - previous;
    const threshold = previous * 0.05; // 5% change threshold
    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'stable';
  }

  function trendIcon(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      case 'stable': return '→';
    }
  }

  function getErrorStatus(errors: number): 'good' | 'warning' | 'critical' {
    if (errors > 50) return 'critical';
    if (errors > 10) return 'warning';
    return 'good';
  }

  function getLatencyStatus(ms: number): 'good' | 'warning' | 'critical' {
    if (ms > 2000) return 'critical';
    if (ms > 500) return 'warning';
    return 'good';
  }

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/metrics');
      const data = await res.json();

      if (data.success) {
        const current: MetricData = {
          errors: data.errors ?? 0,
          avgLatency: data.avgLatency ?? 0,
          activeServices: data.activeServices ?? 0,
          eventsPerMin: data.eventsPerMin ?? 0,
          timestamp: data.timestamp ?? new Date().toISOString(),
        };

        const prev = prevMetrics.current;

        setMetrics([
          {
            label: 'Error Rate',
            value: `${current.errors}`,
            icon: 'err',
            trend: getTrend(current.errors, prev?.errors),
            status: getErrorStatus(current.errors),
          },
          {
            label: 'Avg Latency',
            value: current.avgLatency > 0 ? `${current.avgLatency.toFixed(1)}ms` : '0ms',
            icon: 'lat',
            trend: getTrend(current.avgLatency, prev?.avgLatency),
            status: getLatencyStatus(current.avgLatency),
          },
          {
            label: 'Active Services',
            value: `${current.activeServices}`,
            icon: 'svc',
            trend: getTrend(current.activeServices, prev?.activeServices),
            status: 'good',
          },
          {
            label: 'Event Velocity',
            value: `${current.eventsPerMin.toFixed(0)}/min`,
            icon: 'vel',
            trend: getTrend(current.eventsPerMin, prev?.eventsPerMin),
            status: 'good',
          },
        ]);

        prevMetrics.current = current;
        setHistory(prev => [...prev.slice(-11), current]);
        setLastUpdated(new Date());
        setSecondsAgo(0);
      }
    } catch {
      // Silently handle errors — keep last known metrics
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    intervalRef.current = setInterval(() => {
      if (!paused) fetchMetrics();
    }, 10000);
    tickRef.current = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchMetrics, paused]);

  function statusGlow(status: 'good' | 'warning' | 'critical'): string {
    switch (status) {
      case 'critical': return 'border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.15)]';
      case 'good': return 'border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
    }
  }

  function trendColor(trend: 'up' | 'down' | 'stable', isErrorMetric: boolean): string {
    // For errors, "up" is bad; for services, "up" is good
    if (isErrorMetric) {
      switch (trend) {
        case 'up': return 'text-red-400';
        case 'down': return 'text-emerald-400';
        case 'stable': return 'text-white/40';
      }
    }
    switch (trend) {
      case 'up': return 'text-emerald-400';
      case 'down': return 'text-yellow-400';
      case 'stable': return 'text-white/40';
    }
  }

  function renderBarChart() {
    if (history.length === 0) {
      return (
        <p className="text-xs text-white/30 text-center py-8">
          Collecting data points... Chart will appear after first refresh.
        </p>
      );
    }

    const values = history.map(h => h.eventsPerMin);
    const max = Math.max(...values, 1);
    const barHeight = 8; // max bar height in lines

    return (
      <div className="font-mono text-xs">
        <div className="flex items-end gap-1 h-32 px-2">
          {values.map((val, i) => {
            const height = Math.max(1, Math.round((val / max) * barHeight));
            const percentage = (height / barHeight) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] text-white/40 mb-1">{val.toFixed(0)}</span>
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-sm transition-all duration-500 min-h-[4px]"
                  style={{ height: `${percentage}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 px-2 mt-1 border-t border-white/10 pt-1">
          {history.map((h, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-white/30">
              {new Date(h.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Real-Time Incident Monitor</h2>
            <p className="text-xs text-white/50">Auto-refreshes every 10 seconds</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">
            Last updated: {secondsAgo}s ago
          </span>
          {loading && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          )}
          <button
            onClick={() => { playClickSound(); setPaused(!paused); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors btn-press ${
              paused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white/70'
            }`}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={() => { playClickSound(); fetchMetrics(); }}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors btn-press disabled:opacity-50"
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => {
          const isErrorMetric = i === 0 || i === 1; // errors and latency — "up" is bad
          return (
            <div
              key={i}
              className={`relative overflow-hidden rounded-xl border p-5 backdrop-blur-sm transition-all duration-300 ${statusGlow(metric.status)}`}
            >
              {loading && (
                <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none" />
              )}
              <div className="flex items-start justify-between">
                <span className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-yellow-500' : i === 2 ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                <span className={`text-sm font-bold ${trendColor(metric.trend, isErrorMetric)}`}>
                  {trendIcon(metric.trend)}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-bold text-white tracking-tight">{metric.value}</p>
                <p className="text-xs text-white/50 mt-1">{metric.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time-Series Bar Chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
        <h3 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
          Event Velocity Over Time
          <span className="text-[10px] text-white/30 ml-auto">(events/min — last {history.length} samples)</span>
        </h3>
        {renderBarChart()}
      </div>

      {/* Status Footer */}
      <div className="flex items-center justify-between text-xs text-white/30 px-1">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'}`} />
          {paused ? 'Paused' : 'Live monitoring active'}
        </span>
        <span>{history.length} data points collected</span>
      </div>
    </div>
  );
}
