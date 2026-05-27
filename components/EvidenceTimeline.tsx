'use client';

import { useState } from 'react';
import type { EvidenceItem } from '@/types/index';

interface EvidenceTimelineProps {
  evidence: EvidenceItem[];
}

const typeConfig: Record<string, { color: string; bgColor: string; icon: string; label: string }> = {
  log: { color: 'bg-blue-500', bgColor: 'bg-blue-50 border-blue-200 text-blue-800', icon: '📄', label: 'Log' },
  metric: { color: 'bg-green-500', bgColor: 'bg-green-50 border-green-200 text-green-800', icon: '📊', label: 'Metric' },
  trace: { color: 'bg-purple-500', bgColor: 'bg-purple-50 border-purple-200 text-purple-800', icon: '🔗', label: 'Trace' },
  deployment: { color: 'bg-orange-500', bgColor: 'bg-orange-50 border-orange-200 text-orange-800', icon: '🚀', label: 'Deploy' },
};

const INITIAL_DISPLAY_COUNT = 10;

export default function EvidenceTimeline({ evidence }: EvidenceTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);

  if (evidence.length === 0) {
    return <p className="text-gray-500 text-center">No evidence collected.</p>;
  }

  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const item of evidence) {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  }

  const sources = Array.from(new Set(evidence.map((e) => e.source)));

  const sorted = [...evidence]
    .filter((item) => !filterType || item.type === filterType)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const displayed = showAll ? sorted : sorted.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMore = sorted.length > INITIAL_DISPLAY_COUNT;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-blue-800 font-medium">
            📎 {evidence.length} evidence items collected across {sources.length} sources
          </p>
          {/* Type badges */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                !filterType ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
              }`}
            >
              All ({evidence.length})
            </button>
            {Object.entries(typeCounts).map(([type, count]) => {
              const config = typeConfig[type] || { bgColor: 'bg-gray-50 border-gray-200 text-gray-800', icon: '❓', label: type };
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                    filterType === type ? 'bg-gray-800 text-white border-gray-800' : `${config.bgColor}`
                  }`}
                >
                  {config.icon} {config.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-gray-200 to-gray-100" />

        <div className="space-y-3">
          {displayed.map((item) => {
            const config = typeConfig[item.type] || {
              color: 'bg-gray-500',
              bgColor: 'bg-gray-50 border-gray-200 text-gray-800',
              icon: '❓',
              label: item.type,
            };
            return (
              <div key={item.id} className="relative pl-10">
                {/* Dot on timeline */}
                <div
                  className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ${config.color} ring-2 ring-white shadow-sm`}
                />

                <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{config.icon}</span>
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded text-white ${config.color}`}
                    >
                      {item.type}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Source: <span className="font-medium">{item.source}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show more/less button */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
          >
            {showAll ? `Show less` : `Show all ${sorted.length} items`}
          </button>
        </div>
      )}
    </div>
  );
}
