import { generateRemediation } from '@/lib/analysis/remediationEngine';
import { RemediationStepSchema } from '@/lib/shared/validation';
import type { RootCauseHypothesis } from '@/lib/types';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const deploymentHypothesis: RootCauseHypothesis = {
  id: 'hyp-1',
  type: 'deployment-correlation',
  description: 'A deployment occurred close to the incident start time.',
  confidence: 0.85,
  supportingEvidence: ['ev-1', 'ev-2'],
  recommendedActions: ['Roll back to previous version', 'Review deployment changes'],
};

const errorSpikeHypothesis: RootCauseHypothesis = {
  id: 'hyp-2',
  type: 'error-spike',
  description: 'A significant spike in error logs was detected.',
  confidence: 0.75,
  supportingEvidence: ['ev-3'],
  recommendedActions: ['Investigate error patterns'],
};

const dependencyTimeoutHypothesis: RootCauseHypothesis = {
  id: 'hyp-3',
  type: 'dependency-timeout',
  description: 'Multiple timeout events detected in downstream dependencies.',
  confidence: 0.65,
  supportingEvidence: ['ev-4', 'ev-5'],
  recommendedActions: ['Check dependency health', 'Increase timeout thresholds'],
};

const resourceExhaustionHypothesis: RootCauseHypothesis = {
  id: 'hyp-4',
  type: 'resource-exhaustion',
  description: 'Resource exhaustion indicators detected.',
  confidence: 0.6,
  supportingEvidence: ['ev-6'],
  recommendedActions: ['Scale up resources'],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateRemediation', () => {
  it('returns empty array when hypotheses is empty', () => {
    const result = generateRemediation([]);
    expect(result).toEqual([]);
  });

  it('returns steps for deployment-correlation hypothesis', () => {
    const steps = generateRemediation([deploymentHypothesis]);

    expect(steps).toHaveLength(3);
    expect(steps[0].action).toBe('Verify deployment diff');
    expect(steps[1].action).toBe('Roll back to previous version');
    expect(steps[2].action).toBe('Validate rollback success');
  });

  it('returns steps for error-spike hypothesis', () => {
    const steps = generateRemediation([errorSpikeHypothesis]);

    expect(steps).toHaveLength(3);
    expect(steps[0].action).toBe('Identify error pattern');
    expect(steps[1].action).toBe('Apply error mitigation');
    expect(steps[2].action).toBe('Monitor error rates');
  });

  it('returns steps for dependency-timeout hypothesis', () => {
    const steps = generateRemediation([dependencyTimeoutHypothesis]);

    expect(steps).toHaveLength(3);
    expect(steps[0].action).toBe('Check dependency health');
    expect(steps[1].action).toBe('Increase timeout thresholds');
    expect(steps[2].action).toBe('Enable circuit breaker');
  });

  it('returns steps for resource-exhaustion hypothesis', () => {
    const steps = generateRemediation([resourceExhaustionHypothesis]);

    expect(steps).toHaveLength(3);
    expect(steps[0].action).toBe('Identify resource bottleneck');
    expect(steps[1].action).toBe('Scale up affected resources');
    expect(steps[2].action).toBe('Add monitoring alerts');
  });

  it('all steps pass RemediationStepSchema validation', () => {
    const steps = generateRemediation([
      deploymentHypothesis,
      errorSpikeHypothesis,
      dependencyTimeoutHypothesis,
      resourceExhaustionHypothesis,
    ]);

    for (const step of steps) {
      const result = RemediationStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    }
  });

  it('steps are ordered sequentially (order: 1, 2, 3, ...)', () => {
    const steps = generateRemediation([deploymentHypothesis, errorSpikeHypothesis]);

    expect(steps).toHaveLength(6);
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].order).toBe(i + 1);
    }
  });

  it('high-risk steps require approval', () => {
    const steps = generateRemediation([
      deploymentHypothesis,
      resourceExhaustionHypothesis,
    ]);

    const highRiskSteps = steps.filter((s) => s.riskLevel === 'high');
    expect(highRiskSteps.length).toBeGreaterThan(0);
    for (const step of highRiskSteps) {
      expect(step.requiresApproval).toBe(true);
    }
  });

  it('steps have valid estimatedTime strings', () => {
    const steps = generateRemediation([
      deploymentHypothesis,
      errorSpikeHypothesis,
      dependencyTimeoutHypothesis,
      resourceExhaustionHypothesis,
    ]);

    const timePattern = /^\d+ minutes$/;
    for (const step of steps) {
      expect(step.estimatedTime).toMatch(timePattern);
    }
  });

  it('multiple hypotheses produce combined steps with correct ordering', () => {
    const steps = generateRemediation([
      deploymentHypothesis,
      dependencyTimeoutHypothesis,
    ]);

    // 3 steps from deployment + 3 steps from dependency-timeout = 6 total
    expect(steps).toHaveLength(6);

    // First 3 are deployment steps
    expect(steps[0].action).toBe('Verify deployment diff');
    expect(steps[1].action).toBe('Roll back to previous version');
    expect(steps[2].action).toBe('Validate rollback success');

    // Next 3 are dependency-timeout steps
    expect(steps[3].action).toBe('Check dependency health');
    expect(steps[4].action).toBe('Increase timeout thresholds');
    expect(steps[5].action).toBe('Enable circuit breaker');

    // All ordered sequentially
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].order).toBe(i + 1);
    }
  });
});
