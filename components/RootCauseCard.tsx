'use client';

import type { RootCauseHypothesis } from '@/types/index';

interface RootCauseCardProps {
  hypotheses: RootCauseHypothesis[];
}

export default function RootCauseCard({ hypotheses }: RootCauseCardProps) {
  if (hypotheses.length === 0) {
    return (
      <p className="text-gray-500 text-center">No hypotheses generated.</p>
    );
  }

  return (
    <div className="space-y-4">
      {hypotheses.map((hypothesis) => {
        const confidencePct = Math.round(hypothesis.confidence * 100);
        const barColor =
          confidencePct >= 75
            ? 'bg-red-500'
            : confidencePct >= 50
              ? 'bg-orange-500'
              : confidencePct >= 25
                ? 'bg-yellow-500'
                : 'bg-green-500';

        return (
          <div
            key={hypothesis.id}
            className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                {hypothesis.type}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {confidencePct}% confidence
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-3">
              {hypothesis.description}
            </p>

            {/* Confidence bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full ${barColor} transition-all`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <span>
                📎 {hypothesis.supportingEvidence.length} supporting evidence
              </span>
            </div>

            {hypothesis.recommendedActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Recommended Actions:
                </p>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                  {hypothesis.recommendedActions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
