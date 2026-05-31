import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * POST /api/splunk/query
 *
 * Runs an ad-hoc SPL query against the configured Splunk instance.
 * Enables a future "SPL Console" feature in the UI.
 *
 * Body: { spl: string, earliest?: string, latest?: string }
 * Returns: { results: unknown[], count: number }
 */
export async function POST(request: NextRequest) {
  const config = getSplunkConfig();

  if (!isConfigured(config)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Splunk is not configured. Set SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.',
        results: [],
        count: 0,
      },
      { status: 503 }
    );
  }

  let body: { spl?: string; earliest?: string; latest?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', results: [], count: 0 },
      { status: 400 }
    );
  }

  const { spl, earliest, latest } = body;

  if (!spl || typeof spl !== 'string' || spl.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Missing or empty "spl" field', results: [], count: 0 },
      { status: 400 }
    );
  }

  // Inject time bounds if provided and not already in the query
  let finalSpl = spl.trim();
  if (earliest && !finalSpl.includes('earliest=')) {
    finalSpl = finalSpl.replace(
      /^(index=\S+)/,
      `$1 earliest=${earliest}`
    );
  }
  if (latest && !finalSpl.includes('latest=')) {
    finalSpl = finalSpl.replace(
      /^(index=\S+(?:\s+earliest=\S+)?)/,
      `$1 latest=${latest}`
    );
  }

  try {
    const results = await runQuery(finalSpl, config);
    return NextResponse.json(
      {
        success: true,
        results,
        count: results.length,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        results: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
