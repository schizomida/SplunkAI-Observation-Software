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
 * - Click to toggle tooltip with details
 */
export default function SplunkHealthBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

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

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-all duration-200 ${showTooltip ? 'scale-105' : ''}`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            health.connected ? 'bg-emerald-400' : 'bg-red-400'
          }`}
        />
        <span className={`text-xs font-medium ${health.connected ? 'text-emerald-400' : 'text-red-400'}`}>
          {health.connected ? 'Connected' : 'Disconnected'}
        </span>
      </button>

      {/* Tooltip — appears ABOVE the badge */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl z-[100] pointer-events-auto border border-white/10">
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
      )}
    </div>
  );
}
