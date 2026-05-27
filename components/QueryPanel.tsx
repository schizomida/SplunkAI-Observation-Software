'use client';

import { useState } from 'react';
import type { InvestigationQuery } from '@/types/index';

interface QueryPanelProps {
  queries: InvestigationQuery[];
}

function riskBadge(riskLevel: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[riskLevel] || 'bg-gray-100 text-gray-800 border-gray-200';
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
    return <p className="text-gray-500 text-center">No queries generated.</p>;
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
      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600 font-medium text-sm">🔍</span>
          <p className="text-sm text-indigo-800 font-medium">{summaryText}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Expand all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
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
            className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden card-hover"
          >
            {/* Collapsible header */}
            <button
              onClick={() => toggleExpand(query.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${riskDot(query.riskLevel)}`} />
                <h4 className="font-semibold text-gray-900 text-sm">{query.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${riskBadge(query.riskLevel)}`}
                >
                  {query.riskLevel}
                </span>
                <span className="text-gray-400 text-xs transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </div>
            </button>

            {/* Expandable content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 animate-fade-in-up">
                <p className="text-sm text-gray-600 mt-3 mb-3">{query.description}</p>
                <div className="relative">
                  <pre className="bg-gray-900 text-sm p-4 rounded-lg overflow-x-auto">
                    <code className="text-green-300 font-mono leading-relaxed">{query.spl}</code>
                  </pre>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(query.spl);
                    }}
                    className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                    title="Copy SPL"
                  >
                    📋 Copy
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
