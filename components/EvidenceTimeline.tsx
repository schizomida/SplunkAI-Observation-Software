'use client';

import { useState } from 'react';
import type { EvidenceItem, InvestigationQuery } from '@/lib/types';

interface EvidenceTimelineProps {
  evidence: EvidenceItem[];
  queries?: InvestigationQuery[];
  onNavigate?: (tab: string) => void;
}

const typeConfig: Record<string, { color: string; bgColor: string; icon: string; label: string; queryMatch: string }> = {
  log: { color: 'bg-blue-500', bgColor: 'bg-blue-500/20 border-blue-400/30 text-blue-300', icon: '📄', label: 'Log', queryMatch: 'error-rate-spike' },
  metric: { color: 'bg-green-500', bgColor: 'bg-green-500/20 border-green-400/30 text-green-300', icon: '📊', label: 'Metric', queryMatch: 'anomaly-detection' },
  trace: { color: 'bg-purple-500', bgColor: 'bg-purple-500/20 border-purple-400/30 text-purple-300', icon: '🔗', label: 'Trace', queryMatch: 'latency-percentiles' },
  deployment: { color: 'bg-orange-500', bgColor: 'bg-orange-500/20 border-orange-400/30 text-orange-300', icon: '🚀', label: 'Deploy', queryMatch: 'deployment-correlation' },
};

const INITIAL_DISPLAY_COUNT = 10;

export default function EvidenceTimeline({ evidence, queries, onNavigate }: EvidenceTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (evidence.length === 0) {
    return <p className="text-white/50 text-center">No evidence collected.</p>;
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

  function handleItemClick(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  function getRelatedQuery(type: string): InvestigationQuery | undefined {
    if (!queries) return undefined;
    const config = typeConfig[type];
    if (!config) return undefined;
    return queries.find((q) => q.id.includes(config.queryMatch) || q.name.toLowerCase().includes(config.queryMatch.replace('-', ' ')));
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="bg-blue-500/10 border border-blue-400/20 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-blue-300 font-medium">
            📎 {evidence.length} evidence items collected across {sources.length} sources
          </p>
          {/* Type badges */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                !filterType ? 'bg-white/20 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              All ({evidence.length})
            </button>
            {Object.entries(typeCounts).map(([type, count]) => {
              const config = typeConfig[type] || { bgColor: 'bg-white/10 border-white/20 text-white/70', icon: '❓', label: type, queryMatch: '' };
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(filterType === type ? null : type)}
                  className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                    filterType === type ? 'bg-white/20 text-white border-white/30' : `${config.bgColor}`
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
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500/40 via-white/10 to-transparent" />

        <div className="space-y-3">
          {displayed.map((item) => {
            const config = typeConfig[item.type] || {
              color: 'bg-gray-500',
              bgColor: 'bg-white/10 border-white/20 text-white/70',
              icon: '❓',
              label: item.type,
              queryMatch: '',
            };
            const isExpanded = expandedId === item.id;
            const relatedQuery = getRelatedQuery(item.type);

            return (
              <div key={item.id} className="relative pl-10">
                {/* Dot on timeline */}
                <div
                  className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ${config.color} ring-2 ring-white/20 shadow-sm`}
                />

                <div
                  onClick={() => handleItemClick(item.id)}
                  className={`border border-white/10 rounded-lg p-3 bg-white/5 backdrop-blur shadow-sm cursor-pointer transition-all hover:bg-white/10 hover:border-white/20 ${isExpanded ? 'ring-1 ring-indigo-500/50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{config.icon}</span>
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded text-white ${config.color}`}
                    >
                      {item.type}
                    </span>
                    <span className="text-xs text-white/40 ml-auto font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{item.summary}</p>
                  <p className="text-xs text-white/40 mt-1">
                    Source: <span className="font-medium text-white/60">{item.source}</span>
                  </p>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="mt-2 border border-white/10 rounded-lg p-4 bg-white/5 backdrop-blur animate-fade-in-up">
                    {/* Raw data */}
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">Raw Data</p>
                      <pre className="bg-gray-900/80 text-sm p-3 rounded-lg overflow-x-auto border border-white/10">
                        <code className="text-green-300 font-mono text-xs leading-relaxed">
                          {JSON.stringify(item.data, null, 2)}
                        </code>
                      </pre>
                    </div>

                    {/* Related query */}
                    {relatedQuery && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">Related Query</p>
                        <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg p-3">
                          <p className="text-sm text-indigo-300 font-medium mb-1">{relatedQuery.name}</p>
                          <p className="text-xs text-white/50 mb-2">{relatedQuery.description}</p>
                          <pre className="bg-gray-900/80 text-xs p-2 rounded overflow-x-auto">
                            <code className="text-green-300 font-mono">{relatedQuery.spl}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Navigation buttons */}
                    {onNavigate && (
                      <div className="flex gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('rootcause'); }}
                          className="px-3 py-1.5 text-xs font-medium bg-purple-500/20 border border-purple-400/30 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
                        >
                          Jump to Root Cause →
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('remediation'); }}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors"
                        >
                          Jump to Remediation →
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
            className="px-4 py-2 text-sm font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-400/20 transition-colors"
          >
            {showAll ? `Show less` : `Show all ${sorted.length} items`}
          </button>
        </div>
      )}
    </div>
  );
}
