import type { EvidenceItem, RootCauseHypothesis } from '@/lib/types';
import type { MLInsight } from '@/lib/analysis/splunkMLAnalyzer';

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

/**
 * Scores cascading failure hypothesis.
 * Looks for errors across multiple services in sequence, indicating a cascade.
 */
function scoreCascadingFailure(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  // Find error items across different services
  const errorsByService = new Map<string, EvidenceItem[]>();

  for (const item of evidence) {
    if (item.type !== 'log') continue;
    const level = getDataString(item.data, 'level');
    if (level.toUpperCase() !== 'ERROR') continue;

    const service = item.source || getDataString(item.data, 'service');
    if (!service) continue;

    if (!errorsByService.has(service)) {
      errorsByService.set(service, []);
    }
    errorsByService.get(service)!.push(item);
  }

  // A cascade requires errors in 2+ services
  if (errorsByService.size < 2) {
    return null;
  }

  const allErrorItems = Array.from(errorsByService.values()).flat();
  // Confidence scales with number of affected services
  const confidence = Math.min(0.9, 0.4 + errorsByService.size * 0.15);

  return {
    id: 'hyp-5',
    type: 'cascading-failure',
    description:
      `Errors detected across ${errorsByService.size} services (${Array.from(errorsByService.keys()).join(', ')}), suggesting a cascading failure pattern where one service failure propagates to others.`,
    confidence,
    supportingEvidence: allErrorItems.map((item) => item.id),
    recommendedActions: [
      'Identify the originating service in the cascade',
      'Enable circuit breakers between services',
      'Add bulkhead isolation patterns',
      'Review service dependency graph',
    ],
  };
}

/**
 * Scores performance degradation hypothesis.
 * Looks for latency/duration evidence indicating slowdowns.
 */
function scorePerformanceDegradation(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  const performanceKeywords = [
    'latency',
    'slow',
    'duration',
    'p99',
    'p95',
    'response time',
    'degradation',
    'high latency',
    'spike',
    'delay',
  ];

  const perfItems = evidence.filter((item) => {
    // Check summary
    for (const keyword of performanceKeywords) {
      if (containsIgnoreCase(item.summary, keyword)) return true;
    }

    // Check data for high duration values
    if (item.data !== null && typeof item.data === 'object') {
      const dataStr = JSON.stringify(item.data);
      for (const keyword of performanceKeywords) {
        if (containsIgnoreCase(dataStr, keyword)) return true;
      }
      // Check for durationMs > 1000 (1 second)
      const data = item.data as Record<string, unknown>;
      const duration = parseFloat(String(data?.durationMs ?? '0'));
      if (duration > 1000) return true;
    }

    // Trace items with high duration
    if (item.type === 'trace') return true;

    return false;
  });

  if (perfItems.length === 0) {
    return null;
  }

  const confidence = Math.min(0.9, 0.3 + perfItems.length * 0.1);

  return {
    id: 'hyp-6',
    type: 'performance-degradation',
    description:
      'Performance degradation indicators detected, including high latency spans and slow response times, suggesting a systemic slowdown.',
    confidence,
    supportingEvidence: perfItems.map((item) => item.id),
    recommendedActions: [
      'Profile slow endpoints and database queries',
      'Check for resource contention (CPU, memory, I/O)',
      'Review recent code changes for performance regressions',
      'Analyze garbage collection and thread pool metrics',
    ],
  };
}

/**
 * Scores configuration change hypothesis.
 * Looks for config-related keywords in evidence.
 */
function scoreConfigurationChange(evidence: EvidenceItem[]): RootCauseHypothesis | null {
  const configKeywords = [
    'config',
    'configuration',
    'setting',
    'environment variable',
    'env var',
    'feature flag',
    'toggle',
    'property change',
    'yaml',
    'json config',
    'misconfigur',
    'invalid config',
    'config update',
  ];

  const configItems = evidence.filter((item) => {
    // Check summary
    for (const keyword of configKeywords) {
      if (containsIgnoreCase(item.summary, keyword)) return true;
    }

    // Check data
    if (item.data !== null && typeof item.data === 'object') {
      const dataStr = JSON.stringify(item.data);
      for (const keyword of configKeywords) {
        if (containsIgnoreCase(dataStr, keyword)) return true;
      }
    }

    return false;
  });

  if (configItems.length === 0) {
    return null;
  }

  const confidence = Math.min(0.85, 0.35 + configItems.length * 0.15);

  return {
    id: 'hyp-7',
    type: 'configuration-change',
    description:
      'Configuration change indicators detected in the evidence, suggesting a recent config update may have introduced the issue.',
    confidence,
    supportingEvidence: configItems.map((item) => item.id),
    recommendedActions: [
      'Review recent configuration changes',
      'Compare current config with last known good state',
      'Check feature flag states',
      'Validate environment variable values',
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
    scoreCascadingFailure,
    scorePerformanceDegradation,
    scoreConfigurationChange,
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

/**
 * Enhanced root cause analysis that combines rule-based hypotheses with
 * ML-derived insights from Splunk MLTK.
 *
 * 1. Runs the standard rule-based analysis on evidence.
 * 2. Boosts confidence scores based on corroborating ML insights.
 * 3. Adds new ML-derived hypotheses for patterns not caught by rules.
 * 4. Returns all hypotheses sorted by confidence.
 */
export async function analyzeRootCauseWithML(
  evidence: EvidenceItem[],
  mlInsights: MLInsight[]
): Promise<RootCauseHypothesis[]> {
  // Start with rule-based hypotheses
  const hypotheses = analyzeRootCause(evidence);

  // Boost confidence based on ML insights
  for (const insight of mlInsights) {
    if (insight.type === 'anomaly') {
      // Anomaly detection found metric anomalies → boost resource-exhaustion
      const resourceHyp = hypotheses.find((h) => h.type === 'resource-exhaustion');
      if (resourceHyp) {
        resourceHyp.confidence = Math.min(1, resourceHyp.confidence + 0.1);
      }
    }

    if (insight.type === 'cluster') {
      // Clustering found dominant error patterns → boost error-spike
      const errorHyp = hypotheses.find((h) => h.type === 'error-spike');
      if (errorHyp) {
        errorHyp.confidence = Math.min(1, errorHyp.confidence + 0.1);
      }
    }

    if (insight.type === 'correlation') {
      // Correlation shows deployment events near errors → boost deployment-correlation
      const description = insight.description.toLowerCase();
      if (description.includes('deployment')) {
        const deployHyp = hypotheses.find((h) => h.type === 'deployment-correlation');
        if (deployHyp) {
          deployHyp.confidence = Math.min(1, deployHyp.confidence + 0.1);
        }
      }
    }

    if (insight.type === 'trend') {
      // Trend analysis showing increasing errors → boost cascading-failure
      const description = insight.description.toLowerCase();
      if (description.includes('increasing')) {
        const cascadeHyp = hypotheses.find((h) => h.type === 'cascading-failure');
        if (cascadeHyp) {
          cascadeHyp.confidence = Math.min(1, cascadeHyp.confidence + 0.1);
        }
      }
    }

    if (insight.type === 'velocity') {
      // Event velocity bursts → boost cascading-failure and error-spike
      const cascadeHyp = hypotheses.find((h) => h.type === 'cascading-failure');
      if (cascadeHyp) {
        cascadeHyp.confidence = Math.min(1, cascadeHyp.confidence + 0.05);
      }
      const errorHyp = hypotheses.find((h) => h.type === 'error-spike');
      if (errorHyp) {
        errorHyp.confidence = Math.min(1, errorHyp.confidence + 0.05);
      }
    }

    if (insight.type === 'saturation') {
      // Resource saturation → boost resource-exhaustion and performance-degradation
      const resourceHyp = hypotheses.find((h) => h.type === 'resource-exhaustion');
      if (resourceHyp) {
        resourceHyp.confidence = Math.min(1, resourceHyp.confidence + 0.15);
      }
      const perfHyp = hypotheses.find((h) => h.type === 'performance-degradation');
      if (perfHyp) {
        perfHyp.confidence = Math.min(1, perfHyp.confidence + 0.1);
      }
    }

    if (insight.type === 'outlier') {
      // Trace outliers → boost performance-degradation
      const perfHyp = hypotheses.find((h) => h.type === 'performance-degradation');
      if (perfHyp) {
        perfHyp.confidence = Math.min(1, perfHyp.confidence + 0.15);
      }
    }

    if (insight.type === 'dependency') {
      // Dependency mapping with errors → boost dependency-timeout and cascading-failure
      const depHyp = hypotheses.find((h) => h.type === 'dependency-timeout');
      if (depHyp) {
        depHyp.confidence = Math.min(1, depHyp.confidence + 0.1);
      }
      const cascadeHyp = hypotheses.find((h) => h.type === 'cascading-failure');
      if (cascadeHyp) {
        cascadeHyp.confidence = Math.min(1, cascadeHyp.confidence + 0.05);
      }
    }

    if (insight.type === 'impact') {
      // High impact radius → boost cascading-failure
      const cascadeHyp = hypotheses.find((h) => h.type === 'cascading-failure');
      if (cascadeHyp) {
        cascadeHyp.confidence = Math.min(1, cascadeHyp.confidence + 0.1);
      }
    }
  }

  // Add new ML-derived hypotheses for patterns not caught by rules
  const existingTypes = new Set(hypotheses.map((h) => h.type));

  for (const insight of mlInsights) {
    if (insight.type === 'anomaly' && !existingTypes.has('resource-exhaustion') && insight.confidence > 0.5) {
      hypotheses.push({
        id: `hyp-ml-anomaly`,
        type: 'resource-exhaustion',
        description:
          `ML anomaly detection identified significant metric deviations: ${insight.description}`,
        confidence: insight.confidence * 0.8,
        supportingEvidence: [],
        recommendedActions: [
          'Investigate anomalous metrics',
          'Check resource utilization dashboards',
          'Review auto-scaling policies',
        ],
      });
      existingTypes.add('resource-exhaustion');
    }

    if (insight.type === 'cluster' && !existingTypes.has('error-spike') && insight.confidence > 0.5) {
      hypotheses.push({
        id: `hyp-ml-cluster`,
        type: 'error-spike',
        description:
          `ML clustering identified a dominant error pattern: ${insight.description}`,
        confidence: insight.confidence * 0.8,
        supportingEvidence: [],
        recommendedActions: [
          'Investigate the dominant error pattern',
          'Check recent code changes related to the error',
          'Review error handling logic',
        ],
      });
      existingTypes.add('error-spike');
    }

    if (insight.type === 'correlation' && !existingTypes.has('deployment-correlation') && insight.confidence > 0.5) {
      const description = insight.description.toLowerCase();
      if (description.includes('deployment')) {
        hypotheses.push({
          id: `hyp-ml-correlation`,
          type: 'deployment-correlation',
          description:
            `ML cross-signal correlation detected deployment activity during the incident: ${insight.description}`,
          confidence: insight.confidence * 0.8,
          supportingEvidence: [],
          recommendedActions: [
            'Review recent deployments',
            'Compare metrics before and after deployment',
            'Consider rollback if deployment is correlated',
          ],
        });
        existingTypes.add('deployment-correlation');
      }
    }

    if (insight.type === 'outlier' && !existingTypes.has('performance-degradation') && insight.confidence > 0.5) {
      hypotheses.push({
        id: `hyp-ml-outlier`,
        type: 'performance-degradation',
        description:
          `ML outlier detection found abnormally slow trace spans: ${insight.description}`,
        confidence: insight.confidence * 0.8,
        supportingEvidence: [],
        recommendedActions: [
          'Profile the slow operations identified',
          'Check for lock contention or resource starvation',
          'Review database query performance',
        ],
      });
      existingTypes.add('performance-degradation');
    }

    if (insight.type === 'velocity' && !existingTypes.has('cascading-failure') && insight.confidence > 0.5) {
      hypotheses.push({
        id: `hyp-ml-velocity`,
        type: 'cascading-failure',
        description:
          `ML event velocity analysis detected sudden bursts suggesting cascading failures: ${insight.description}`,
        confidence: insight.confidence * 0.75,
        supportingEvidence: [],
        recommendedActions: [
          'Identify the origin service of the cascade',
          'Enable circuit breakers',
          'Add rate limiting to prevent cascade propagation',
        ],
      });
      existingTypes.add('cascading-failure');
    }

    if (insight.type === 'saturation' && !existingTypes.has('resource-exhaustion') && insight.confidence > 0.5) {
      hypotheses.push({
        id: `hyp-ml-saturation`,
        type: 'resource-exhaustion',
        description:
          `ML resource saturation scoring identified critically saturated resources: ${insight.description}`,
        confidence: insight.confidence * 0.85,
        supportingEvidence: [],
        recommendedActions: [
          'Scale up saturated resources immediately',
          'Implement auto-scaling policies',
          'Add resource usage alerts at lower thresholds',
        ],
      });
      existingTypes.add('resource-exhaustion');
    }
  }

  // Re-sort by confidence descending
  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return hypotheses;
}
