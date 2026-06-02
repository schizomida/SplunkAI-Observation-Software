'use client';

import { useState } from 'react';
import type { RemediationStep } from '@/lib/types';

interface RemediationChecklistProps {
  steps: RemediationStep[];
}

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

export default function RemediationChecklist({
  steps,
}: RemediationChecklistProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  if (steps.length === 0) {
    return (
      <p className="text-white/50 text-center">No remediation steps generated.</p>
    );
  }

  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const approvalCount = steps.filter((s) => s.requiresApproval).length;
  const highRiskCount = steps.filter((s) => s.riskLevel === 'high').length;

  // Estimate total time (parse "X min" or "X minutes" patterns)
  const totalMinutes = steps.reduce((acc, step) => {
    const match = step.estimatedTime.match(/(\d+)/);
    return acc + (match ? parseInt(match[1], 10) : 5);
  }, 0);

  const completedCount = completedSteps.size;
  const progressPct = (completedCount / steps.length) * 100;

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

  return (
    <div className="space-y-4">
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
        {sorted.map((step) => {
          const isCompleted = completedSteps.has(step.id);
          return (
            <div
              key={step.id}
              className={`border border-white/10 border-l-4 ${riskBorderColor(step.riskLevel)} rounded-lg p-4 bg-white/5 backdrop-blur shadow-sm transition-all ${
                isCompleted ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
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
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded border ${riskBadge(step.riskLevel)}`}
                    >
                      {step.riskLevel} risk
                    </span>
                    {step.requiresApproval && (
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-300 border border-purple-400/30">
                        ⚠️ Approval Required
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-white/60 mb-2">{step.description}</p>

                  <p className="text-xs text-white/40">
                    ⏱ Estimated: {step.estimatedTime}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
