import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

interface QueryMapping {
  keywords: string[];
  spl: string;
  explanation: string;
}

/**
 * Rule-based natural language to SPL mappings.
 */
const QUERY_MAPPINGS: QueryMapping[] = [
  {
    keywords: ['error', 'errors'],
    spl: 'index=main sourcetype=app_logs level=ERROR earliest=-1h | stats count by service message | sort -count | head 10',
    explanation: 'Searching for errors in the last hour, grouped by service and message.',
  },
  {
    keywords: ['latency', 'slow'],
    spl: 'index=main sourcetype=app_traces earliest=-1h | stats avg(durationMs) as avg p99(durationMs) as p99 by service | sort -p99',
    explanation: 'Analyzing latency metrics — average and p99 response times by service.',
  },
  {
    keywords: ['timeout'],
    spl: 'index=main sourcetype=app_logs (*timeout* OR *ETIMEDOUT*) earliest=-1h | stats count by service | sort -count',
    explanation: 'Finding timeout events across all services in the last hour.',
  },
  {
    keywords: ['deploy', 'deployment'],
    spl: 'index=main sourcetype=deployment earliest=-7d | table _time service version previousVersion environment',
    explanation: 'Showing deployment history from the last 7 days.',
  },
  {
    keywords: ['services', 'affected'],
    spl: 'index=main earliest=-1h | stats count dc(host) as hosts by service | sort -count',
    explanation: 'Listing active services with event counts and unique hosts.',
  },
  {
    keywords: ['metric', 'cpu', 'memory'],
    spl: 'index=main sourcetype=app_metrics earliest=-1h | stats latest(value) as current avg(value) as avg max(value) as peak by metric_name',
    explanation: 'Showing current, average, and peak values for system metrics.',
  },
];

const DEFAULT_QUERY = {
  spl: 'index=main earliest=-30m | stats count by sourcetype service level | sort -count | head 20',
  explanation: 'Showing a summary of recent events grouped by source type, service, and level.',
};

/**
 * Matches a user message to an SPL query using keyword matching.
 */
function matchQuery(message: string): { spl: string; explanation: string } {
  const lower = message.toLowerCase();

  // Score each mapping by keyword matches
  let bestMatch: QueryMapping | null = null;
  let bestScore = 0;

  for (const mapping of QUERY_MAPPINGS) {
    let score = 0;
    for (const keyword of mapping.keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = mapping;
    }
  }

  if (bestMatch && bestScore > 0) {
    return { spl: bestMatch.spl, explanation: bestMatch.explanation };
  }

  return DEFAULT_QUERY;
}

/**
 * POST /api/chat/query
 *
 * Accepts: { message: string }
 * Returns: { spl: string, results: unknown[], count: number, explanation: string }
 */
export async function POST(request: NextRequest) {
  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', spl: '', results: [], count: 0, explanation: '' },
      { status: 400 }
    );
  }

  const { message } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty "message" field', spl: '', results: [], count: 0, explanation: '' },
      { status: 400 }
    );
  }

  const { spl, explanation } = matchQuery(message.trim());
  const config = getSplunkConfig();

  // If Splunk isn't configured, return the SPL with mock results
  if (!isConfigured(config)) {
    return NextResponse.json({
      spl,
      results: [
        { service: 'api-gateway', count: '42', level: 'ERROR', message: 'Connection refused' },
        { service: 'auth-service', count: '18', level: 'ERROR', message: 'Token expired' },
        { service: 'payment-svc', count: '7', level: 'WARN', message: 'Retry attempt 3' },
      ],
      count: 3,
      explanation: explanation + ' (demo mode — showing sample data)',
    });
  }

  try {
    const results = await runQuery(spl, config);
    return NextResponse.json({
      spl,
      results,
      count: results.length,
      explanation,
    });
  } catch (error) {
    return NextResponse.json({
      spl,
      results: [],
      count: 0,
      explanation,
      error: error instanceof Error ? error.message : 'Query execution failed',
    });
  }
}
