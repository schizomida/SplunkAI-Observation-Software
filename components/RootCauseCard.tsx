'use client';

import { useState, useEffect, useRef } from 'react';
import type { RootCauseHypothesis } from '@/lib/types';

interface RootCauseCardProps {
  hypotheses: RootCauseHypothesis[];
  highlightedType?: string | null;
}

type SortMode = 'highest-confidence' | 'lowest-confidence' | 'by-type';

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

export default function RootCauseCard({ hypotheses, highlightedType }: RootCauseCardProps) {
  const [sortMode, setSortMode] = useState<SortMode>('highest-confidence');
  const [filterByType, setFilterByType] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Scroll highlighted into view
  useEffect(() => {
    if (highlightedType && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedType]);

  if (hypotheses.length === 0) {
    return <p className="text-white/50 text-center">No hypotheses generated.</p>;
  }

  // Get unique types
  const uniqueTypes = Array.from(new Set(hypotheses.map((h) => h.type)));

  // Apply filter
  let filtered = filterByType
    ? hypotheses.filter((h) => h.type === filterByType)
    : [...hypotheses];

  // Sort
  filtered = filtered.sort((a, b) => {
    switch (sortMode) {
      case 'highest-confidence':
        return b.confidence - a.confidence;
      case 'lowest-confidence':
        return a.confidence - b.confidence;
      case 'by-type':
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  const topHypothesis = hypotheses[0];
  const topConfidence = Math.round(topHypothesis.confidence * 100);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg px-4 py-3">
        <p className="text-sm text-amber-300 font-medium">
          🧠 Top hypothesis: <span className="font-bold">{topHypothesis.type}</span> with{' '}
          <span className="font-bold">{topConfidence}%</span> confidence
          {hypotheses.length > 1 && ` — ${hypotheses.length - 1} alternative ${hypotheses.length - 1 === 1 ? 'hypothesis' : 'hypotheses'} also considered`}
        </p>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="px-3 py-1.5 text-xs font-medium bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="highest-confidence" className="bg-gray-900">Highest Confidence</option>
          <option value="lowest-confidence" className="bg-gray-900">Lowest Confidence</option>
          <option value="by-type" className="bg-gray-900">By Type</option>
        </select>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterByType(null)}
            className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
              !filterByType ? 'bg-white/20 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {uniqueTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterByType(filterByType === type ? null : type)}
              className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                filterByType === type ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Hypothesis cards */}
      {filtered.map((hypothesis, index) => {
        const confidencePct = Math.round(hypothesis.confidence * 100);
        const gradient = getConfidenceGradient(confidencePct);
        const label = getConfidenceLabel(confidencePct);
        const isTop = index === 0 && !filterByType && sortMode === 'highest-confidence';
        const isHighlighted = highlightedType && hypothesis.type === highlightedType;

        return (
          <div
            key={hypothesis.id}
            ref={isHighlighted ? highlightRef : undefined}
            className={`border rounded-xl p-5 bg-white/5 backdrop-blur shadow-sm transition-all ${
              isTop ? 'border-indigo-400/30 ring-1 ring-indigo-500/20' : 'border-white/10'
            } ${isHighlighted ? 'ring-2 ring-purple-400 glow-ring-animation' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  isTop ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/60'
                }`}>
                  {getRankLabel(index)}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {hypothesis.type}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-white">{confidencePct}%</span>
                <span className="text-xs text-white/50 block">{label}</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-4 leading-relaxed">{hypothesis.description}</p>
            <div className="mb-4">
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
              <span className="flex items-center gap-1">📎 {hypothesis.supportingEvidence.length} supporting evidence</span>
            </div>
            {hypothesis.recommendedActions.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-xs font-semibold text-white/60 mb-2 uppercase tracking-wide">Recommended Actions</p>
                <ul className="space-y-1">
                  {hypothesis.recommendedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                      <span className="text-indigo-400 mt-0.5">→</span>
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
