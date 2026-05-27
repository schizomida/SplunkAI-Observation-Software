import crypto from 'crypto';
import type { RootCauseHypothesis, RemediationStep } from '@/types/index';

// ── Playbook Definitions ──────────────────────────────────────────────────────

interface PlaybookStep {
  action: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  estimatedTime: string;
}

const playbooks: Record<string, PlaybookStep[]> = {
  'deployment-correlation': [
    {
      action: 'Verify deployment diff',
      description: 'Review the deployment diff to identify potentially breaking changes introduced in the latest release.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '5 minutes',
    },
    {
      action: 'Roll back to previous version',
      description: 'Initiate a rollback to the last known good deployment version to restore service stability.',
      riskLevel: 'high',
      requiresApproval: true,
      estimatedTime: '10 minutes',
    },
    {
      action: 'Validate rollback success',
      description: 'Confirm that the rollback resolved the issue by checking key metrics and error rates.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '5 minutes',
    },
  ],
  'error-spike': [
    {
      action: 'Identify error pattern',
      description: 'Analyze error logs to identify the common pattern, affected endpoints, and error categories.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '10 minutes',
    },
    {
      action: 'Apply error mitigation',
      description: 'Apply targeted mitigation such as feature flags, rate limiting, or fallback logic to reduce error impact.',
      riskLevel: 'medium',
      requiresApproval: false,
      estimatedTime: '15 minutes',
    },
    {
      action: 'Monitor error rates',
      description: 'Monitor error rates post-mitigation to confirm the fix is effective and no new errors emerge.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '30 minutes',
    },
  ],
  'dependency-timeout': [
    {
      action: 'Check dependency health',
      description: 'Verify the health status of downstream dependencies including latency, availability, and error rates.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '5 minutes',
    },
    {
      action: 'Increase timeout thresholds',
      description: 'Temporarily increase timeout thresholds to accommodate degraded dependency performance.',
      riskLevel: 'medium',
      requiresApproval: false,
      estimatedTime: '10 minutes',
    },
    {
      action: 'Enable circuit breaker',
      description: 'Enable circuit breaker pattern to prevent cascading failures from the degraded dependency.',
      riskLevel: 'medium',
      requiresApproval: true,
      estimatedTime: '15 minutes',
    },
  ],
  'resource-exhaustion': [
    {
      action: 'Identify resource bottleneck',
      description: 'Determine which resource (CPU, memory, connections, disk) is exhausted and identify the root cause.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '10 minutes',
    },
    {
      action: 'Scale up affected resources',
      description: 'Scale up the affected resources by increasing limits, adding replicas, or expanding capacity.',
      riskLevel: 'high',
      requiresApproval: true,
      estimatedTime: '15 minutes',
    },
    {
      action: 'Add monitoring alerts',
      description: 'Add proactive monitoring alerts for resource utilization thresholds to prevent future exhaustion.',
      riskLevel: 'low',
      requiresApproval: false,
      estimatedTime: '10 minutes',
    },
  ],
};

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Generates remediation steps based on ranked root cause hypotheses.
 *
 * For each hypothesis, looks up the corresponding playbook and generates
 * ordered remediation steps with risk levels and approval requirements.
 *
 * Steps are ordered sequentially across all hypotheses (1, 2, 3, ...).
 */
export function generateRemediation(hypotheses: RootCauseHypothesis[]): RemediationStep[] {
  if (!hypotheses || hypotheses.length === 0) {
    return [];
  }

  const steps: RemediationStep[] = [];
  let orderCounter = 1;

  for (const hypothesis of hypotheses) {
    const playbookSteps = playbooks[hypothesis.type];

    if (!playbookSteps) {
      continue;
    }

    for (const step of playbookSteps) {
      steps.push({
        id: crypto.randomUUID(),
        order: orderCounter,
        action: step.action,
        description: step.description,
        riskLevel: step.riskLevel,
        requiresApproval: step.requiresApproval,
        estimatedTime: step.estimatedTime,
      });
      orderCounter++;
    }
  }

  return steps;
}
