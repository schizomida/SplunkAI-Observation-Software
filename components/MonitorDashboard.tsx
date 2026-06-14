'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MonitorMetrics {
  totalEvents: number;
  errorCount: number;
  activeServices: number;
  avgLatency: number;
}

interface MonitorEvent {
  _time: string;
  service: string;
  level: string;
  message: string;
  sourcetype: string;
}

interface MonitorData {
  success: boolean;
  metrics: MonitorMetrics | null;
  recentEvents: MonitorEvent[] | null;
  timestamp: string;
  error: string | null;
}

interface MetricTrend {
  totalEvents: 'up' | 'down' | 'same';
  errorCount: 'up' | 'down' | 'same';
  activeServices: 'up' | 'down' | 'same';
  avgLatency: 'up' | 'down' | 'same';
}

const REFRESH_INTERVAL = 10; // seconds

export default function MonitorDashboard() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<MonitorMetrics | null>(null);
  const [trends, setTrends] = useState<MetricTrend>({
    totalEvents: 'same',
    errorCount: 'same',
    activeServices: 'same',
    avgLatency: 'same',
  });
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [pulsing, setPulsing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const computeTrend = (prev: number, curr: number): 'up' | 'down' | 'same' => {
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return 'same';
  };

  const fetchMonitorData = useCallback(async () => {
    try {
      const res = await fetch('/api/splunk/monitor');
      const json: MonitorData = await res.json();

      if (!json.success) {
        setError(json.error || 'Failed to fetch monitor data');
        setLoading(false);
        return;
      }

      // Compute trends comparing to previous metrics
      if (prevMetrics && json.metrics) {
        const newTrends: MetricTrend = {
          totalEvents: computeTrend(prevMetrics.totalEvents, json.metrics.totalEvents),
          errorCount: computeTrend(prevMetrics.errorCount, json.metrics.errorCount),
          activeServices: computeTrend(prevMetrics.activeServices, json.metrics.activeServices),
          avgLatency: computeTrend(prevMetrics.avgLatency, json.metrics.avgLatency),
        };
        setTrends(newTrends);

        // Determine which metrics changed for pulse animation
        const changed: string[] = [];
        if (json.metrics.totalEvents !== prevMetrics.totalEvents) changed.push('totalEvents');
        if (json.metrics.errorCount !== prevMetrics.errorCount) changed.push('errorCount');
        if (json.metrics.activeServices !== prevMetrics.activeServices) changed.push('activeServices');
        if (json.metrics.avgLatency !== prevMetrics.avgLatency) changed.push('avgLatency');
        setPulsing(changed);
        setTimeout(() => setPulsing([]), 600);
      }

      if (json.metrics) {
        setPrevMetrics(json.metrics);
      }

      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [prevMetrics]);

  // Initial fetch
  useEffect(() => {
    fetchMonitorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    setCountdown(REFRESH_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL;
        return prev - 1;
      });
    }, 1000);

    intervalRef.current = setInterval(() => {
      fetchMonitorData();
      setCountdown(REFRESH_INTERVAL);
    }, REFRESH_INTERVAL * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [paused, fetchMonitorData]);

  function trendArrow(trend: 'up' | 'down' | 'same') {
    if (trend === 'up') return <span className="text-emerald-400">↑</span>;
    if (trend === 'down') return <span className="text-red-400">↓</span>;
    return <span className="text-white/30">→</span>;
  }

  function levelColor(level: string): string {
    switch (level?.toUpperCase()) {
      case 'ERROR': return 'text-red-400';
      case 'WARN':
      case 'WARNING': return 'text-yellow-400';
      case 'INFO': return 'text-blue-400';
      case 'DEBUG': return 'text-white/40';
      default: return 'text-white/60';
    }
  }

  function levelBadge(level: string): string {
    switch (level?.toUpperCase()) {
      case 'ERROR': return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'WARN':
      case 'WARNING': return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'INFO': return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      default: return 'bg-white/10 text-white/50 border-white/20';
    }
  }

  // Loading shimmer state
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📡</span>
            <div>
              <h2 className="text-lg font-bold text-white">Real-Time Monitor</h2>
              <p className="text-xs text-white/50">Loading live metrics...</p>
            </div>
          </div>
        </div>
        {/* Shimmer cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 h-28 shimmer" />
          ))}
        </div>
        {/* Shimmer event list */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg shimmer" />
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
          <span className="text-2xl">📡</span>
          <div>
            <h2 className="text-lg font-bold text-white">Real-Time Monitor</h2>
            <p className="text-xs text-white/50">
              Live metrics from Splunk, auto-refreshing every {REFRESH_INTERVAL}s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Countdown indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 ${!paused ? 'animate-breathe' : ''}`}>
            <span className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
            <span className="text-xs text-white/60 font-mono">
              {paused ? 'Paused' : `${countdown}s`}
            </span>
          </div>
          {/* Pause/Resume button */}
          <button
            onClick={() => setPaused(!paused)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all btn-press bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10">
          <span>⚠️</span>
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={() => { setError(null); fetchMonitorData(); }}
            className="ml-auto text-xs text-red-300 hover:text-red-200 underline btn-press"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric Cards */}
      {data?.metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Events"
            value={data.metrics.totalEvents.toLocaleString()}
            subtitle="Last 5 minutes"
            icon="📊"
            trend={trends.totalEvents}
            trendArrow={trendArrow(trends.totalEvents)}
            pulse={pulsing.includes('totalEvents')}
          />
          <MetricCard
            title="Error Count"
            value={data.metrics.errorCount.toLocaleString()}
            subtitle="Last 5 minutes"
            icon="🚨"
            trend={trends.errorCount}
            trendArrow={trendArrow(trends.errorCount)}
            pulse={pulsing.includes('errorCount')}
            alert={data.metrics.errorCount > 0}
          />
          <MetricCard
            title="Active Services"
            value={data.metrics.activeServices.toLocaleString()}
            subtitle="Distinct services"
            icon="🔧"
            trend={trends.activeServices}
            trendArrow={trendArrow(trends.activeServices)}
            pulse={pulsing.includes('activeServices')}
          />
          <MetricCard
            title="Avg Latency"
            value={data.metrics.avgLatency > 0 ? `${data.metrics.avgLatency.toFixed(1)}ms` : '—'}
            subtitle="Mean duration"
            icon="⚡"
            trend={trends.avgLatency}
            trendArrow={trendArrow(trends.avgLatency)}
            pulse={pulsing.includes('avgLatency')}
          />
        </div>
      )}

      {/* Live Event Feed */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📜</span>
            <h3 className="text-sm font-semibold text-white">Live Event Feed</h3>
            <span className="text-xs text-white/40">
              ({data?.recentEvents?.length ?? 0} events)
            </span>
          </div>
          {data?.timestamp && (
            <span className="text-[10px] text-white/30 font-mono">
              Last updated: {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {data?.recentEvents && data.recentEvents.length > 0 ? (
            <div className="divide-y divide-white/5">
              {data.recentEvents.map((event, idx) => (
                <div
                  key={`${event._time}-${idx}`}
                  className={`px-5 py-3 hover:bg-white/5 transition-colors animate-fade-in-up`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono text-white/40 w-20 shrink-0`}>
                      {event._time ? new Date(event._time).toLocaleTimeString() : '—'}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${levelBadge(event.level)}`}>
                      {event.level || '—'}
                    </span>
                    <span className="text-xs text-indigo-300 font-medium w-24 truncate shrink-0">
                      {event.service || '—'}
                    </span>
                    <span className={`text-xs truncate ${levelColor(event.level)}`}>
                      {event.message || '—'}
                    </span>
                    <span className="ml-auto text-[10px] text-white/20 shrink-0">
                      {event.sourcetype}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-white/40">No events in the last 5 minutes</p>
              <p className="text-xs text-white/25 mt-1">Events will appear here as they come in</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card Sub-Component ─────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  trend: 'up' | 'down' | 'same';
  trendArrow: React.ReactNode;
  pulse: boolean;
  alert?: boolean;
}

function MetricCard({ title, value, subtitle, icon, trendArrow, pulse, alert }: MetricCardProps) {
  return (
    <div className={`glass-card rounded-xl p-5 transition-all duration-300 ${alert ? 'border-red-400/40' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-lg">{icon}</span>
        <div className="text-sm">{trendArrow}</div>
      </div>
      <div className={`text-2xl font-bold text-white mb-1 transition-transform duration-300 ${pulse ? 'scale-110' : 'scale-100'}`}>
        {value}
      </div>
      <div className="text-xs text-white/50">{title}</div>
      <div className="text-[10px] text-white/30 mt-0.5">{subtitle}</div>
    </div>
  );
}
