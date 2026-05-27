import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, IncidentReport, Incident } from '@/types/index';
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
 * Shared handler for both GET and POST.
 * POST allows passing the incident in the request body as a fallback
 * when the in-memory store doesn't have it (dev mode module isolation).
 */
async function handleReport(
  request: NextRequest,
  id: string
): Promise<NextResponse<ApiResponse<IncidentReport>>> {
  // Input validation
  if (!id || id.length > 128) {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid incident id', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  // Try store first, then request body
  let incident: Incident | undefined = incidentStore.get(id);

  if (!incident) {
    try {
      const body = await request.json();
      if (body && body.id === id) {
        incident = body as Incident;
        incidentStore.set(id, incident);
      }
    } catch {
      // No body — that's fine for GET requests
    }
  }

  if (!incident) {
    return NextResponse.json(
      { success: false, data: null, error: 'Incident not found', timestamp: new Date().toISOString() },
      { status: 404 }
    );
  }

  try {
    // Run investigation pipeline
    const queries = generateQueries(incident);

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

    const report = generateReport(incident, investigationResult);

    return NextResponse.json(
      { success: true, data: report, error: null, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Report] Pipeline error:`, error);
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : 'Report generation failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * GET /api/incidents/[id]/report
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<IncidentReport>>> {
  return handleReport(request, params.id);
}

/**
 * POST /api/incidents/[id]/report
 * Same as GET but accepts incident data in the request body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<IncidentReport>>> {
  return handleReport(request, params.id);
}
