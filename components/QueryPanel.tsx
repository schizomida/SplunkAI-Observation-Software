'use client';

import { useState } from 'react';
import type { InvestigationQuery } from '@/lib/types';

interface QueryPanelProps {
  queries: InvestigationQuery[];
}

function riskBadge(riskLevel: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300 border-red-400/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    low: 'bg-green-500/20 text-green-300 border-green-400/30',
  };
  return colors[riskLevel] || 'bg-white/10 text-white/70 border-white/20';
}

function riskDot(riskLevel: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };
  return colors[riskLevel] || 'bg-gray-500';
}

export default function QueryPanel({ queries }: QueryPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (queries.length === 0) {
    return <p className="text-white/50 text-center">No queries generated.</p>;
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(queries.map((q) => q.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  // Generate a summary of query targets
  const queryTargets = queries.map((q) => q.name.toLowerCase());
  const summaryText = `${queries.length} investigation queries generated targeting ${queryTargets.slice(0, 5).join(', ')}${queryTargets.length > 5 ? '...' : ''}`;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-400/20 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-indigo-300 font-medium">{summaryText}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
          >
            Expand all
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Query cards */}
      {queries.map((query) => {
        const isExpanded = expandedIds.has(query.id);
        return (
          <div
            key={query.id}
            className="border border-white/10 rounded-lg bg-white/5 backdrop-blur shadow-sm overflow-hidden card-hover"
          >
            {/* Collapsible header */}
            <button
              onClick={() => toggleExpand(query.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${riskDot(query.riskLevel)}`} />
                <h4 className="font-semibold text-white/90 text-sm">{query.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${riskBadge(query.riskLevel)}`}
                >
                  {query.riskLevel}
                </span>
                <span className="text-white/40 text-xs transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </div>
            </button>

            {/* Expandable content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-white/10 animate-fade-in-up">
                <p className="text-sm text-white/60 mt-3 mb-3">{query.description}</p>
                <div className="relative">
                  <pre className="bg-gray-900/80 text-sm p-4 rounded-lg overflow-x-auto border border-white/10">
                    <code className="text-green-300 font-mono leading-relaxed">{query.spl}</code>
                  </pre>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(query.spl);
                    }}
                    className="absolute top-2 right-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
                    title="Copy SPL"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
