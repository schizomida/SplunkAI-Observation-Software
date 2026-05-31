import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, InvestigationResult } from '@/lib/types';
import { incidentStore } from '@/lib/splunk/incidentStore';
import { generateQueries } from '@/lib/analysis/queryGenerator';
import { loadDemoEvidence } from '@/lib/analysis/demoLoader';
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
 * Strategy:
 * 1. Look up incident from store, or accept it in the request body
 * 2. If Splunk is configured (token + ALLOW_LIVE_SPL=true): run live queries
 * 3. If mode is 'demo' or Splunk is not configured: use demo evidence
 *
 * Pipeline: generateQueries → evidence (live or demo) → analyzeRootCause → generateRemediation
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

  // Try to find incident in store first, then fall back to request body
  let incident = incidentStore.get(id);

  if (!incident) {
    // Try to parse incident from request body as fallback
    try {
      const body = await request.json();
      if (body && body.id === id) {
        incident = body as typeof incident;
        // Store it for future lookups
        incidentStore.set(id, incident!);
      }
    } catch {
      // No body or invalid JSON — that's fine, we'll 404 below
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

    // Determine evidence source: live Splunk or demo data
    const config = getSplunkConfig();
    const useLive = isConfigured(config) && incident.mode === 'live';
    const useLiveAuto = isConfigured(config) && incident.mode === 'demo';

    let rawEvidence;
    let evidenceSource: string;

    if (useLive || useLiveAuto) {
      // Try live Splunk first
      try {
        console.log(`[Investigate] Running live queries against Splunk for incident ${id}`);
        rawEvidence = await collectLiveEvidence(queries);

        // If live returned no results, fall back to demo
        if (rawEvidence.length === 0 && incident.mode === 'demo') {
          console.log(`[Investigate] Live queries returned no results, falling back to demo data`);
          rawEvidence = loadDemoEvidence();
          evidenceSource = 'demo (live returned empty)';
        } else {
          evidenceSource = 'live-splunk';
        }
      } catch (error) {
        // If live fails and mode is demo, fall back gracefully
        console.error(`[Investigate] Live Splunk failed, falling back to demo:`, error instanceof Error ? error.message : error);
        rawEvidence = loadDemoEvidence();
        evidenceSource = 'demo (live failed)';
      }
    } else {
      // Use demo evidence
      rawEvidence = loadDemoEvidence();
      evidenceSource = 'demo';
    }

    // Mask sensitive fields before returning evidence to client
    const evidence = maskSensitiveFields(rawEvidence);

    // Run ML analysis and root cause analysis
    let hypotheses;
    if (isConfigured(config)) {
      // Convert ISO timestamps to epoch for ML queries
      const earliestEpoch = Math.floor(new Date(incident.startTime).getTime() / 1000).toString();
      const latestEpoch = Math.floor(new Date(incident.endTime).getTime() / 1000).toString();

      const mlInsights = await runMLAnalysis(earliestEpoch, latestEpoch);
      hypotheses = await analyzeRootCauseWithML(evidence, mlInsights);
    } else {
      hypotheses = analyzeRootCause(evidence);
    }

    const remediation = generateRemediation(hypotheses);

    const result: InvestigationResult = {
      incidentId: incident.id,
      queries,
      evidence,
      hypotheses,
      remediation,
      analyzedAt: new Date().toISOString(),
    };

    console.log(`[Investigate] Complete — source: ${evidenceSource}, evidence: ${evidence.length}, hypotheses: ${hypotheses.length}`);

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
