'use client';

import { useState, useEffect } from 'react';

interface HealthStatus {
  connected: boolean;
  version: string;
  indexes: number;
  mltkInstalled: boolean;
}

/**
 * SplunkHealthBadge — shows Splunk connection status in the header.
 *
 * - Green dot + "Connected" when Splunk is reachable
 * - Red dot + "Disconnected" when not
 * - Shows Splunk version on hover
 */
export default function SplunkHealthBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/splunk/health');
        if (res.ok) {
          const data: HealthStatus = await res.json();
          setHealth(data);
        } else {
          setHealth({ connected: false, version: 'N/A', indexes: 0, mltkInstalled: false });
        }
      } catch {
        setHealth({ connected: false, version: 'N/A', indexes: 0, mltkInstalled: false });
      } finally {
        setLoading(false);
      }
    }

    checkHealth();

    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm">
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
        <span className="text-xs text-white/70">Checking...</span>
      </div>
    );
  }

  if (!health) return null;

  const tooltipText = health.connected
    ? `Splunk v${health.version} | ${health.indexes} indexes | MLTK: ${health.mltkInstalled ? 'Yes' : 'No'}`
    : 'Splunk is not reachable. Check SPLUNK_HOST, SPLUNK_TOKEN, and ALLOW_LIVE_SPL settings.';

  return (
    <div
      className="relative group flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-sm cursor-default"
      title={tooltipText}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          health.connected ? 'bg-green-400' : 'bg-red-400'
        }`}
      />
      <span className="text-xs text-white/90 font-medium">
        {health.connected ? 'Connected' : 'Disconnected'}
      </span>

      {/* Tooltip on hover */}
      <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        {health.connected ? (
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Version:</span>
              <span className="font-medium">{health.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Indexes:</span>
              <span className="font-medium">{health.indexes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">MLTK:</span>
              <span className={`font-medium ${health.mltkInstalled ? 'text-green-400' : 'text-yellow-400'}`}>
                {health.mltkInstalled ? 'Installed' : 'Not Found'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-300">
            Not connected to Splunk. Ensure SPLUNK_TOKEN and ALLOW_LIVE_SPL=true are set.
          </p>
        )}
      </div>
    </div>
  );
}
