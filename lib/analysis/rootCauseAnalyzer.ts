import type { EvidenceItem, RootCauseHypothesis } from '@/types/index';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely reads a string property from an unknown value.
 */
function getDataString(data: unknown, key: string): string {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const val = (data as Record<string, unknown>)[key];
    return typeof val === 'string' ? val : '';
  }
  return '';
}

/**
 * Checks if a string contains a substring (case-insensitive).
 */
function containsIgnoreCase(text: string, search: string): boolean {
  return text.toLowerCase().includes(search.toLowerCase());
}

// ── Hypothesis Scorers ────────────────────────────────────────────────────────

/**
 * Scores deployment correlation hypothesis.
 * Looks for deployment evidence items. Higher confidence if deployments exist.
 */
function scoreDeploymentCorrelation(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  const deploymentItems = evidence.filter((item) => item.type === 'deployment');

  if (deploymentItems.length === 0) {
    return null;
  }

  // More deployments near the incident increase confidence
  // Base confidence of 0.6 for any deployment, up to 0.9 for multiple
  const confidence = Math.min(0.9, 0.6 + deploymentItems.length * 0.1);

  return {
    id: 'hyp-1',
    type: 'deployment-correlation',
    description:
      'A deployment occurred close to the incident start time, suggesting the deployment may have introduced the issue.',
    confidence,
    supportingEvidence: deploymentItems.map((item) => item.id),
    recommendedActions: [
      'Roll back to previous version',
      'Review deployment changes',
    ],
  };
}

/**
 * Scores error spike hypothesis.
 * Counts log evidence items with ERROR level in their data.
 */
function scoreErrorSpike(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  const errorItems = evidence.filter((item) => {
    if (item.type !== 'log') return false;
    const level = getDataString(item.data, 'level');
    return level.toUpperCase() === 'ERROR';
  });

  if (errorItems.length === 0) {
    return null;
  }

  // Confidence scales with error count: 1 error → 0.3, 5+ errors → 0.7+
  const confidence = Math.min(0.95, 0.2 + errorItems.length * 0.1);

  return {
    id: 'hyp-2',
    type: 'error-spike',
    description:
      'A significant spike in error logs was detected, indicating a systemic failure pattern.',
    confidence,
    supportingEvidence: errorItems.map((item) => item.id),
    recommendedActions: [
      'Investigate error patterns',
      'Check error handling code',
    ],
  };
}

/**
 * Scores dependency timeout hypothesis.
 * Looks for evidence items mentioning timeout in their summary or data.
 */
function scoreDependencyTimeout(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  const timeoutItems = evidence.filter((item) => {
    // Check summary for timeout mentions
    if (containsIgnoreCase(item.summary, 'timeout')) return true;

    // Check data for timeout mentions
    if (item.data !== null && typeof item.data === 'object') {
      const dataStr = JSON.stringify(item.data);
      if (containsIgnoreCase(dataStr, 'timeout')) return true;
    }

    return false;
  });

  if (timeoutItems.length === 0) {
    return null;
  }

  // Confidence scales with timeout occurrences: 1 → 0.4, 3+ → 0.7+
  const confidence = Math.min(0.9, 0.3 + timeoutItems.length * 0.15);

  return {
    id: 'hyp-3',
    type: 'dependency-timeout',
    description:
      'Multiple timeout events detected in downstream dependencies, suggesting a dependency health issue.',
    confidence,
    supportingEvidence: timeoutItems.map((item) => item.id),
    recommendedActions: [
      'Check dependency health',
      'Increase timeout thresholds',
      'Add circuit breaker',
    ],
  };
}

/**
 * Scores resource exhaustion hypothesis.
 * Looks for evidence mentioning pool saturation, high utilization, or resource limits.
 */
function scoreResourceExhaustion(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  const resourceKeywords = [
    'pool saturation',
    'high utilization',
    'resource limit',
    'exhaustion',
    'out of memory',
    'oom',
    'cpu limit',
    'memory limit',
    'pool full',
    'connection pool',
    'saturated',
  ];

  const resourceItems = evidence.filter((item) => {
    // Check summary
    for (const keyword of resourceKeywords) {
      if (containsIgnoreCase(item.summary, keyword)) return true;
    }

    // Check data
    if (item.data !== null && typeof item.data === 'object') {
      const dataStr = JSON.stringify(item.data);
      for (const keyword of resourceKeywords) {
        if (containsIgnoreCase(dataStr, keyword)) return true;
      }
    }

    return false;
  });

  if (resourceItems.length === 0) {
    return null;
  }

  // Confidence scales with resource issue occurrences
  const confidence = Math.min(0.9, 0.4 + resourceItems.length * 0.15);

  return {
    id: 'hyp-4',
    type: 'resource-exhaustion',
    description:
      'Resource exhaustion indicators detected, such as pool saturation or high utilization, suggesting capacity limits were reached.',
    confidence,
    supportingEvidence: resourceItems.map((item) => item.id),
    recommendedActions: [
      'Scale up resources',
      'Increase pool size',
      'Add resource monitoring alerts',
    ],
  };
}

// ── Main Analyzer ─────────────────────────────────────────────────────────────

/**
 * Analyzes evidence items and generates ranked root cause hypotheses.
 *
 * Returns up to 4 hypotheses sorted by confidence (highest first).
 * Only hypotheses with confidence > 0 are included.
 */
export function analyzeRootCause(evidence: EvidenceItem[]): RootCauseHypothesis[] {
  const scorers = [
    scoreDeploymentCorrelation,
    scoreErrorSpike,
    scoreDependencyTimeout,
    scoreResourceExhaustion,
  ];

  const hypotheses: RootCauseHypothesis[] = [];

  for (const scorer of scorers) {
    const hypothesis = scorer(evidence);
    if (hypothesis !== null && hypothesis.confidence > 0) {
      hypotheses.push(hypothesis);
    }
  }

  // Sort by confidence descending
  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return hypotheses;
}
