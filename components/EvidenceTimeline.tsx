'use client';

import type { EvidenceItem } from '@/types/index';

interface EvidenceTimelineProps {
  evidence: EvidenceItem[];
}

const typeConfig: Record<string, { color: string; icon: string }> = {
  log: { color: 'bg-blue-500', icon: '📄' },
  metric: { color: 'bg-green-500', icon: '📊' },
  trace: { color: 'bg-purple-500', icon: '🔗' },
  deployment: { color: 'bg-orange-500', icon: '🚀' },
};

export default function EvidenceTimeline({ evidence }: EvidenceTimelineProps) {
  if (evidence.length === 0) {
    return <p className="text-gray-500 text-center">No evidence collected.</p>;
  }

  const sorted = [...evidence].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {sorted.map((item) => {
          const config = typeConfig[item.type] || {
            color: 'bg-gray-500',
            icon: '❓',
          };
          return (
            <div key={item.id} className="relative pl-10">
              {/* Dot on timeline */}
              <div
                className={`absolute left-2.5 top-2 w-3 h-3 rounded-full ${config.color} ring-2 ring-white`}
              />

              <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{config.icon}</span>
                  <span
                    className={`px-1.5 py-0.5 text-xs font-medium rounded text-white ${config.color}`}
                  >
                    {item.type}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{item.summary}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Source: {item.source}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
