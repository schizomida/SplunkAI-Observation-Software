import { analyzeRootCause } from '@/lib/analysis/rootCauseAnalyzer';
import { RootCauseHypothesisSchema } from '@/lib/shared/validation';
import type { EvidenceItem } from '@/lib/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvidence(overrides: Partial<EvidenceItem> & { id: string }): EvidenceItem {
  return {
    type: 'log',
    timestamp: '2024-01-15T10:00:00.000Z',
    source: 'test-service',
    data: {},
    summary: '',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('analyzeRootCause', () => {
  it('returns empty array when evidence is empty', () => {
    const result = analyzeRootCause([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when evidence has no matching patterns', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'ev-1', type: 'log', data: { level: 'INFO' }, summary: 'All good' }),
      makeEvidence({ id: 'ev-2', type: 'metric', summary: 'Normal value recorded' }),
    ];
    const result = analyzeRootCause(evidence);
    expect(result).toEqual([]);
  });

  it('detects deployment-correlation hypothesis when deployment evidence exists', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deployed v2.0' }),
    ];
    const result = analyzeRootCause(evidence);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const deployHyp = result.find((h) => h.type === 'deployment-correlation');
    expect(deployHyp).toBeDefined();
    expect(deployHyp!.confidence).toBeGreaterThan(0);
  });

  it('detects error-spike hypothesis when ERROR log items exist', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'err-1', type: 'log', data: { level: 'ERROR' }, summary: 'Connection failed' }),
      makeEvidence({ id: 'err-2', type: 'log', data: { level: 'ERROR' }, summary: 'Timeout error' }),
    ];
    const result = analyzeRootCause(evidence);
    const errorHyp = result.find((h) => h.type === 'error-spike');
    expect(errorHyp).toBeDefined();
    expect(errorHyp!.confidence).toBeGreaterThan(0);
  });

  it('detects dependency-timeout hypothesis when timeout-related evidence exists', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'to-1', type: 'log', summary: 'Redis connection timeout after 5000ms' }),
    ];
    const result = analyzeRootCause(evidence);
    const timeoutHyp = result.find((h) => h.type === 'dependency-timeout');
    expect(timeoutHyp).toBeDefined();
    expect(timeoutHyp!.confidence).toBeGreaterThan(0);
  });

  it('detects resource-exhaustion hypothesis when pool/saturation evidence exists', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'res-1', type: 'metric', summary: 'Connection pool saturation at 98%' }),
    ];
    const result = analyzeRootCause(evidence);
    const resourceHyp = result.find((h) => h.type === 'resource-exhaustion');
    expect(resourceHyp).toBeDefined();
    expect(resourceHyp!.confidence).toBeGreaterThan(0);
  });

  it('all hypotheses pass RootCauseHypothesisSchema validation', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deployed v2.0' }),
      makeEvidence({ id: 'err-1', type: 'log', data: { level: 'ERROR' }, summary: 'Failure' }),
      makeEvidence({ id: 'to-1', type: 'trace', summary: 'Downstream timeout detected' }),
      makeEvidence({ id: 'res-1', type: 'metric', summary: 'Pool saturation reached' }),
    ];
    const result = analyzeRootCause(evidence);
    expect(result.length).toBeGreaterThan(0);
    for (const hypothesis of result) {
      const parsed = RootCauseHypothesisSchema.safeParse(hypothesis);
      expect(parsed.success).toBe(true);
    }
  });

  it('hypotheses are sorted by confidence (highest first)', () => {
    const evidence: EvidenceItem[] = [
      // Multiple deployments → high confidence
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deploy A' }),
      makeEvidence({ id: 'dep-2', type: 'deployment', summary: 'Deploy B' }),
      makeEvidence({ id: 'dep-3', type: 'deployment', summary: 'Deploy C' }),
      // Single error → lower confidence
      makeEvidence({ id: 'err-1', type: 'log', data: { level: 'ERROR' }, summary: 'Error' }),
    ];
    const result = analyzeRootCause(evidence);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });

  it('confidence values are between 0 and 1', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'dep-2', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'dep-3', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'dep-4', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'dep-5', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'err-1', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-2', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-3', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-4', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-5', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-6', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-7', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'err-8', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'to-1', type: 'log', summary: 'timeout' }),
      makeEvidence({ id: 'to-2', type: 'log', summary: 'timeout' }),
      makeEvidence({ id: 'to-3', type: 'log', summary: 'timeout' }),
      makeEvidence({ id: 'to-4', type: 'log', summary: 'timeout' }),
      makeEvidence({ id: 'to-5', type: 'log', summary: 'timeout' }),
      makeEvidence({ id: 'res-1', type: 'metric', summary: 'pool saturation' }),
      makeEvidence({ id: 'res-2', type: 'metric', summary: 'pool saturation' }),
      makeEvidence({ id: 'res-3', type: 'metric', summary: 'pool saturation' }),
      makeEvidence({ id: 'res-4', type: 'metric', summary: 'pool saturation' }),
      makeEvidence({ id: 'res-5', type: 'metric', summary: 'pool saturation' }),
    ];
    const result = analyzeRootCause(evidence);
    for (const hypothesis of result) {
      expect(hypothesis.confidence).toBeGreaterThanOrEqual(0);
      expect(hypothesis.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('more evidence items increase confidence scores', () => {
    const singleDeploy: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deploy' }),
    ];
    const multiDeploy: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'dep-2', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'dep-3', type: 'deployment', summary: 'Deploy' }),
    ];

    const singleResult = analyzeRootCause(singleDeploy);
    const multiResult = analyzeRootCause(multiDeploy);

    const singleConf = singleResult.find((h) => h.type === 'deployment-correlation')!.confidence;
    const multiConf = multiResult.find((h) => h.type === 'deployment-correlation')!.confidence;

    expect(multiConf).toBeGreaterThan(singleConf);
  });

  it('supportingEvidence arrays contain the correct evidence item IDs', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'dep-99', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'err-42', type: 'log', data: { level: 'ERROR' }, summary: 'Fail' }),
    ];
    const result = analyzeRootCause(evidence);

    const deployHyp = result.find((h) => h.type === 'deployment-correlation');
    expect(deployHyp!.supportingEvidence).toContain('dep-99');

    const errorHyp = result.find((h) => h.type === 'error-spike');
    expect(errorHyp!.supportingEvidence).toContain('err-42');
  });

  it('recommendedActions arrays are non-empty for each hypothesis', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deploy' }),
      makeEvidence({ id: 'err-1', type: 'log', data: { level: 'ERROR' }, summary: 'Err' }),
      makeEvidence({ id: 'to-1', type: 'log', summary: 'timeout occurred' }),
      makeEvidence({ id: 'res-1', type: 'metric', summary: 'pool saturation' }),
    ];
    const result = analyzeRootCause(evidence);
    expect(result.length).toBeGreaterThan(0);
    for (const hypothesis of result) {
      expect(hypothesis.recommendedActions.length).toBeGreaterThan(0);
    }
  });

  it('with mixed evidence types, multiple hypotheses are returned', () => {
    const evidence: EvidenceItem[] = [
      makeEvidence({ id: 'dep-1', type: 'deployment', summary: 'Deployed v2.0' }),
      makeEvidence({ id: 'err-1', type: 'log', data: { level: 'ERROR' }, summary: 'Connection failed' }),
      makeEvidence({ id: 'err-2', type: 'log', data: { level: 'ERROR' }, summary: 'Timeout error' }),
      makeEvidence({ id: 'to-1', type: 'log', summary: 'Redis connection timeout after 5000ms' }),
      makeEvidence({ id: 'res-1', type: 'metric', summary: 'Connection pool saturation at 98%' }),
    ];
    const result = analyzeRootCause(evidence);
    expect(result.length).toBeGreaterThan(1);
    // Verify sort order is maintained
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });
});
