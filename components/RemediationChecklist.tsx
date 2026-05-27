'use client';

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

export default function RemediationChecklist({
  steps,
}: RemediationChecklistProps) {
  if (steps.length === 0) {
    return (
      <p className="text-gray-500 text-center">No remediation steps generated.</p>
    );
  }

  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {sorted.map((step) => (
        <div
          key={step.id}
          className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
        >
          <div className="flex items-start gap-3">
            {/* Order number */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">
              {step.order}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-semibold text-gray-900 text-sm">
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
      ))}
    </div>
  );
}
