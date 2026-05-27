import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, IncidentReport } from '@/types/index';
import { incidentStore } from '@/lib/incidentStore';
import { generateQueries } from '@/lib/analysis/queryGenerator';
import { loadDemoEvidence } from '@/lib/analysis/demoLoader';
import { collectLiveEvidence } from '@/lib/analysis/liveEvidenceCollector';
import { maskSensitiveFields } from '@/lib/analysis/evidenceNormalizer';
import { analyzeRootCause } from '@/lib/analysis/rootCauseAnalyzer';
import { generateRemediation } from '@/lib/analysis/remediationEngine';
import { generateReport } from '@/lib/reporting/reportGenerator';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * GET /api/incidents/[id]/report
 * Runs the investigation pipeline and generates a markdown report.
 *
 * Uses live Splunk data when configured, falls back to demo data otherwise.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<IncidentReport>>> {
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

  const incident = incidentStore.get(id);

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
    // Run investigation pipeline
    const queries = generateQueries(incident);

    // Determine evidence source
    const config = getSplunkConfig();
    const useLive = isConfigured(config);

    let rawEvidence;
    if (useLive) {
      try {
        rawEvidence = await collectLiveEvidence(queries);
        if (rawEvidence.length === 0) {
          rawEvidence = loadDemoEvidence();
        }
      } catch {
        rawEvidence = loadDemoEvidence();
      }
    } else {
      rawEvidence = loadDemoEvidence();
    }

    const evidence = maskSensitiveFields(rawEvidence);
    const hypotheses = analyzeRootCause(evidence);
    const remediation = generateRemediation(hypotheses);

    const investigationResult = {
      incidentId: incident.id,
      queries,
      evidence,
      hypotheses,
      remediation,
      analyzedAt: new Date().toISOString(),
    };

    // Generate report
    const report = generateReport(incident, investigationResult);

    return NextResponse.json(
      {
        success: true,
        data: report,
        error: null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Report] Pipeline error:`, error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Report generation failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
