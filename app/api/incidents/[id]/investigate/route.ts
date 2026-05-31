import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, InvestigationResult } from '@/lib/types';
import { incidentStore } from '@/lib/splunk/incidentStore';
import { generateQueries } from '@/lib/analysis/queryGenerator';
import { collectLiveEvidence } from '@/lib/analysis/liveEvidenceCollector';
import { maskSensitiveFields } from '@/lib/analysis/evidenceNormalizer';
import { analyzeRootCause, analyzeRootCauseWithML } from '@/lib/analysis/rootCauseAnalyzer';
import { generateRemediation } from '@/lib/analysis/remediationEngine';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';
import { runMLAnalysis } from '@/lib/analysis/splunkMLAnalyzer';

/**
 * POST /api/incidents/[id]/investigate
 * Runs the full investigation pipeline for the given incident.
 *
 * Requires a live Splunk connection (SPLUNK_TOKEN + ALLOW_LIVE_SPL=true).
 * Returns 503 if Splunk is not configured.
 *
 * Pipeline: generateQueries → collectLiveEvidence → analyzeRootCause → generateRemediation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<InvestigationResult>>> {
  const { id } = params;

  // Input validation: id must be a non-empty string with reasonable length
  if (!id || id.length > 128) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Invalid incident id',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  // Require live Splunk connection
  const config = getSplunkConfig();
  if (!isConfigured(config)) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Splunk connection required. Configure SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  // Try to find incident in store first, then fall back to request body
  let incident = incidentStore.get(id);

  if (!incident) {
    try {
      const body = await request.json();
      if (body && body.id === id) {
        incident = body as typeof incident;
        incidentStore.set(id, incident!);
      }
    } catch {
      // No body or invalid JSON
    }
  }

  if (!incident) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Incident not found',
        timestamp: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  try {
    // Generate investigation queries
    const queries = generateQueries(incident);

    // Collect live evidence from Splunk
    console.log(`[Investigate] Running live queries against Splunk for incident ${id}`);
    const rawEvidence = await collectLiveEvidence(queries);

    // Mask sensitive fields before returning evidence to client
    const evidence = maskSensitiveFields(rawEvidence);

    // Run ML analysis and root cause analysis
    const earliestEpoch = Math.floor(new Date(incident.startTime).getTime() / 1000).toString();
    const latestEpoch = Math.floor(new Date(incident.endTime).getTime() / 1000).toString();

    const mlInsights = await runMLAnalysis(earliestEpoch, latestEpoch);
    const hypotheses = await analyzeRootCauseWithML(evidence, mlInsights);

    const remediation = generateRemediation(hypotheses);

    const result: InvestigationResult = {
      incidentId: incident.id,
      queries,
      evidence,
      hypotheses,
      remediation,
      analyzedAt: new Date().toISOString(),
    };

    console.log(`[Investigate] Complete — evidence: ${evidence.length}, hypotheses: ${hypotheses.length}`);

    return NextResponse.json(
      {
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Investigate] Pipeline error:`, error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Investigation pipeline failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
