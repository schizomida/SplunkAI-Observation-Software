'use client';

import type { RootCauseHypothesis } from '@/lib/types';

interface RootCauseCardProps {
  hypotheses: RootCauseHypothesis[];
}

function getRankLabel(index: number): string {
  const labels = ['1st', '2nd', '3rd'];
  return labels[index] || `${index + 1}th`;
}

function getConfidenceGradient(pct: number): string {
  if (pct >= 75) return 'from-red-500 to-orange-500';
  if (pct >= 50) return 'from-orange-500 to-yellow-500';
  if (pct >= 25) return 'from-yellow-500 to-green-500';
  return 'from-green-500 to-emerald-500';
}

function getConfidenceLabel(pct: number): string {
  if (pct >= 75) return 'Very High';
  if (pct >= 50) return 'High';
  if (pct >= 25) return 'Moderate';
  return 'Low';
}

export default function RootCauseCard({ hypotheses }: RootCauseCardProps) {
  if (hypotheses.length === 0) {
    return (
      <p className="text-gray-500 text-center">No hypotheses generated.</p>
    );
  }

  const topHypothesis = hypotheses[0];
  const topConfidence = Math.round(topHypothesis.confidence * 100);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
        <p className="text-sm text-amber-800 font-medium">
          🧠 Top hypothesis: <span className="font-bold">{topHypothesis.type}</span> with{' '}
          <span className="font-bold">{topConfidence}%</span> confidence
          {hypotheses.length > 1 && ` — ${hypotheses.length - 1} alternative ${hypotheses.length - 1 === 1 ? 'hypothesis' : 'hypotheses'} also considered`}
        </p>
      </div>

      {/* Hypothesis cards */}
      {hypotheses.map((hypothesis, index) => {
        const confidencePct = Math.round(hypothesis.confidence * 100);
        const gradient = getConfidenceGradient(confidencePct);
        const label = getConfidenceLabel(confidencePct);
        const isTop = index === 0;

        return (
          <div
            key={hypothesis.id}
            className={`border rounded-xl p-5 bg-white shadow-sm transition-all ${
              isTop ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  isTop ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {getRankLabel(index)}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {hypothesis.type}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-gray-900">{confidencePct}%</span>
                <span className="text-xs text-gray-500 block">{label}</span>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4 leading-relaxed">
              {hypothesis.description}
            </p>

            {/* Confidence bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>

            {/* Evidence count */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <span className="flex items-center gap-1">
                📎 {hypothesis.supportingEvidence.length} supporting evidence
              </span>
            </div>

            {/* Recommended actions */}
            {hypothesis.recommendedActions.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  Recommended Actions
                </p>
                <ul className="space-y-1">
                  {hypothesis.recommendedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="text-indigo-500 mt-0.5">→</span>
                      <span>{action}</span>
                    </li>
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
