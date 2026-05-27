'use client';

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

export default function QueryPanel({ queries }: QueryPanelProps) {
  if (queries.length === 0) {
    return <p className="text-gray-500 text-center">No queries generated.</p>;
  }

  return (
    <div className="space-y-4">
      {queries.map((query) => (
        <div
          key={query.id}
          className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900">{query.name}</h4>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded border ${riskBadge(query.riskLevel)}`}
            >
              {query.riskLevel}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{query.description}</p>
          <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded overflow-x-auto">
            <code>{query.spl}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
