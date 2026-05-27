'use client';

import { useState } from 'react';
import type { RemediationStep } from '@/types/index';

interface RemediationChecklistProps {
  steps: RemediationStep[];
}

function riskBadge(riskLevel: string) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[riskLevel] || 'bg-gray-100 text-gray-800 border-gray-200';
}

function riskBorderColor(riskLevel: string) {
  const colors: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-green-500',
  };
  return colors[riskLevel] || 'border-l-gray-300';
}

export default function RemediationChecklist({
  steps,
}: RemediationChecklistProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  if (steps.length === 0) {
    return (
      <p className="text-gray-500 text-center">No remediation steps generated.</p>
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
      <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-purple-800 font-medium">
            🛠️ {steps.length} steps{approvalCount > 0 && `, ${approvalCount} require approval`}
            {highRiskCount > 0 && `, ${highRiskCount} high-risk`}
            {' — '}estimated total time: ~{totalMinutes} min
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">
            Progress: {completedCount}/{steps.length} steps complete
          </span>
          <span className="text-xs font-bold text-indigo-600">{Math.round(progressPct)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
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
              className={`border border-gray-200 border-l-4 ${riskBorderColor(step.riskLevel)} rounded-lg p-4 bg-white shadow-sm transition-all ${
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
                      : 'border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {isCompleted ? (
                    <span className="text-xs font-bold">✓</span>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{step.order}</span>
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className={`font-semibold text-sm ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {step.action}
                    </h4>
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded border ${riskBadge(step.riskLevel)}`}
                    >
                      {step.riskLevel} risk
                    </span>
                    {step.requiresApproval && (
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 border border-purple-200">
                        ⚠️ Approval Required
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{step.description}</p>

                  <p className="text-xs text-gray-400">
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
