'use client';

import { useState, useEffect, useRef } from 'react';
import type { RemediationStep } from '@/lib/types';
import { playCelebrationSound } from '@/lib/sounds';

interface RemediationChecklistProps {
  steps: RemediationStep[];
  highlightedStepId?: string | null;
}

type SortMode = 'by-order' | 'risk-high' | 'risk-low' | 'pending-first';
type FilterMode = 'all' | 'pending' | 'completed' | 'requires-approval';

function riskBadge(riskLevel: string) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-300 border-red-400/30',
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    low: 'bg-green-500/20 text-green-300 border-green-400/30',
  };
  return colors[riskLevel] || 'bg-white/10 text-white/70 border-white/20';
}

function riskBorderColor(riskLevel: string) {
  const colors: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500',
  };
  return colors[riskLevel] || 'border-l-white/30';
}

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface ConfettiPiece {
  id: number;
  color: string;
  x: number;
  y: number;
  delay: number;
  size: number;
  rotation: number;
}

export default function RemediationChecklist({ steps, highlightedStepId }: RemediationChecklistProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('by-order');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showCelebration, setShowCelebration] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const highlightRef = useRef<HTMLDivElement>(null);

  const allCompleted = steps.length > 0 && completedSteps.size === steps.length;

  // Scroll highlighted into view
  useEffect(() => {
    if (highlightedStepId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedStepId]);

  // Trigger celebration when all completed
  useEffect(() => {
    if (allCompleted && !showCelebration) {
      triggerCelebration();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted]);

  function triggerCelebration() {
    setShowCelebration(true);
    playCelebrationSound();

    const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
    const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
      delay: Math.random() * 0.5,
      size: 6 + Math.random() * 10,
      rotation: Math.random() * 360,
    }));
    setConfetti(pieces);

    setTimeout(() => {
      setConfetti([]);
    }, 3000);
  }

  if (steps.length === 0) {
    return <p className="text-white/50 text-center">No remediation steps generated.</p>;
  }

  const approvalCount = steps.filter((s) => s.requiresApproval).length;
  const highRiskCount = steps.filter((s) => s.riskLevel === 'high').length;
  const totalMinutes = steps.reduce((acc, step) => {
    const match = step.estimatedTime.match(/(\d+)/);
    return acc + (match ? parseInt(match[1], 10) : 5);
  }, 0);

  const completedCount = completedSteps.size;
  const progressPct = (completedCount / steps.length) * 100;

  // Filter
  let filtered = [...steps];
  switch (filterMode) {
    case 'pending':
      filtered = filtered.filter((s) => !completedSteps.has(s.id));
      break;
    case 'completed':
      filtered = filtered.filter((s) => completedSteps.has(s.id));
      break;
    case 'requires-approval':
      filtered = filtered.filter((s) => s.requiresApproval);
      break;
  }

  // Sort
  filtered = filtered.sort((a, b) => {
    switch (sortMode) {
      case 'by-order':
        return a.order - b.order;
      case 'risk-high':
        return (RISK_ORDER[a.riskLevel] ?? 3) - (RISK_ORDER[b.riskLevel] ?? 3);
      case 'risk-low':
        return (RISK_ORDER[b.riskLevel] ?? 3) - (RISK_ORDER[a.riskLevel] ?? 3);
      case 'pending-first': {
        const aComp = completedSteps.has(a.id) ? 1 : 0;
        const bComp = completedSteps.has(b.id) ? 1 : 0;
        return aComp - bComp || a.order - b.order;
      }
      default:
        return 0;
    }
  });

  function toggleStep(id: string) {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleMarkAllComplete() {
    const allIds = new Set(steps.map((s) => s.id));
    setCompletedSteps(allIds);
  }

  return (
    <div className="space-y-4 relative">
      {/* Confetti */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            marginLeft: `${piece.x}vw`,
            marginTop: `${piece.y}vh`,
            animationDelay: `${piece.delay}s`,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}

      {/* Celebration banner */}
      {showCelebration && (
        <div className="bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 border border-purple-400/30 rounded-xl p-6 text-center animate-scale-in">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-xl font-bold text-white">All Steps Completed!</p>
          <p className="text-sm text-white/60 mt-1">Great work! All remediation steps have been addressed.</p>
        </div>
      )}

      {/* Summary header */}
      <div className="bg-purple-500/10 border border-purple-400/20 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-purple-300 font-medium">
            🛠️ {steps.length} steps{approvalCount > 0 && `, ${approvalCount} require approval`}
            {highRiskCount > 0 && `, ${highRiskCount} high-risk`}
            {' — '}estimated total time: ~{totalMinutes} min
          </p>
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="px-3 py-1.5 text-xs font-medium bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="by-order" className="bg-gray-900">By Order</option>
          <option value="risk-high" className="bg-gray-900">By Risk (High First)</option>
          <option value="risk-low" className="bg-gray-900">By Risk (Low First)</option>
          <option value="pending-first" className="bg-gray-900">Pending First</option>
        </select>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'pending', 'completed', 'requires-approval'] as FilterMode[]).map((mode) => {
            const labels: Record<FilterMode, string> = {
              all: 'All',
              pending: 'Pending Only',
              completed: 'Completed Only',
              'requires-approval': 'Requires Approval',
            };
            return (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
                  filterMode === mode ? 'bg-white/20 text-white border-white/30' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-white/60">
            Progress: {completedCount}/{steps.length} steps complete
          </span>
          <span className="text-xs font-bold text-indigo-300">{Math.round(progressPct)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {filtered.map((step) => {
          const isCompleted = completedSteps.has(step.id);
          const isHighlighted = highlightedStepId === step.id;
          return (
            <div
              key={step.id}
              ref={isHighlighted ? highlightRef : undefined}
              className={`border border-white/10 border-l-4 ${riskBorderColor(step.riskLevel)} rounded-lg p-4 bg-white/5 backdrop-blur shadow-sm transition-all ${
                isCompleted ? 'opacity-60' : ''
              } ${isHighlighted ? 'ring-2 ring-emerald-400 glow-ring-animation' : ''}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleStep(step.id)}
                  className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-white/30 hover:border-indigo-400'
                  }`}
                >
                  {isCompleted ? (
                    <span className="text-xs font-bold">✓</span>
                  ) : (
                    <span className="text-xs font-bold text-white/40">{step.order}</span>
                  )}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className={`font-semibold text-sm ${isCompleted ? 'line-through text-white/30' : 'text-white/90'}`}>
                      {step.action}
                    </h4>
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${riskBadge(step.riskLevel)}`}>
                      {step.riskLevel} risk
                    </span>
                    {step.requiresApproval && (
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                        ⚠️ Approval Required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/60 mb-2">{step.description}</p>
                  <p className="text-xs text-white/40">⏱ Estimated: {step.estimatedTime}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mark All Complete button */}
      {!allCompleted && (
        <div className="text-center pt-2">
          <button
            onClick={handleMarkAllComplete}
            className="px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg transition-all shadow-sm btn-press"
          >
            ✅ Mark All Complete
          </button>
        </div>
      )}
    </div>
  );
}
