import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * POST /api/splunk/nl-query
 *
 * Accepts a natural language query, converts it to SPL using rule-based
 * template matching, runs it against Splunk, and returns the results.
 *
 * Body: { query: string }
 * Returns: { spl: string, results: unknown[], count: number, interpretation: string }
 */

interface NLRule {
  patterns: RegExp[];
  spl: string;
  interpretation: string;
}

const NL_RULES: NLRule[] = [
  {
    patterns: [/show\s*(me\s+)?errors/i, /\berrors?\b/i, /\bfailed\b/i, /\bfailures?\b/i],
    spl: 'index=main level=ERROR earliest=-1h | table _time service message | head 20',
    interpretation: 'Showing ERROR-level events from the last hour',
  },
  {
    patterns: [/how\s+many\s+events/i, /event\s+count/i, /total\s+events/i, /count\s+events/i],
    spl: 'index=main earliest=-1h | stats count',
    interpretation: 'Counting total events in the last hour',
  },
  {
    patterns: [/which\s+services/i, /services?\s+(are\s+)?affected/i, /affected\s+services/i, /service\s+breakdown/i],
    spl: 'index=main earliest=-1h | stats count by service | sort -count',
    interpretation: 'Breaking down event counts by service to identify affected services',
  },
  {
    patterns: [/show\s+deployments/i, /recent\s+deployments/i, /\bdeploy/i, /\breleases?\b/i],
    spl: 'index=main sourcetype=deployment earliest=-7d | table _time service version | sort -_time | head 20',
    interpretation: 'Showing recent deployments from the last 7 days',
  },
  {
    patterns: [/\blatency\b/i, /\bslow\b/i, /response\s+time/i, /\bperformance\b/i, /\bduration\b/i],
    spl: 'index=main sourcetype=app_traces earliest=-1h | stats avg(durationMs) as avg_latency_ms p99(durationMs) as p99_latency_ms by service | sort -p99_latency_ms',
    interpretation: 'Analyzing latency metrics (avg and p99) by service over the last hour',
  },
  {
    patterns: [/\bwarnings?\b/i, /\bwarn\b/i],
    spl: 'index=main level=WARN earliest=-1h | table _time service message | head 20',
    interpretation: 'Showing WARNING-level events from the last hour',
  },
  {
    patterns: [/\btop\b.*\berrors?\b/i, /most\s+common\s+errors/i, /frequent\s+errors/i],
    spl: 'index=main level=ERROR earliest=-1h | top limit=10 message',
    interpretation: 'Finding the most frequently occurring error messages',
  },
  {
    patterns: [/error\s+rate/i, /error\s+trend/i, /errors?\s+over\s+time/i],
    spl: 'index=main level=ERROR earliest=-1h | timechart span=5m count',
    interpretation: 'Charting error rate over time (5-minute buckets)',
  },
  {
    patterns: [/\bhealth\b/i, /service\s+status/i, /\boverview\b/i],
    spl: 'index=main earliest=-1h | stats count as total count(eval(level="ERROR")) as errors by service | eval error_rate=round(errors/total*100,1) | sort -error_rate',
    interpretation: 'Showing service health overview with error rates',
  },
  {
    patterns: [/\bspike\b/i, /\banomaly\b/i, /\bsurge\b/i, /\bunusual\b/i],
    spl: 'index=main earliest=-1h | timechart span=1m count by level',
    interpretation: 'Looking for volume spikes by charting events per minute by level',
  },
];

function convertToSPL(query: string): { spl: string; interpretation: string } {
  const trimmed = query.trim();

  // Try each rule in order; first match wins
  for (const rule of NL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return { spl: rule.spl, interpretation: rule.interpretation };
      }
    }
  }

  // Default: if it looks like SPL already (starts with index= or search), run it directly
  if (/^(index=|search\s|\|)/i.test(trimmed)) {
    return {
      spl: trimmed,
      interpretation: 'Running your SPL query directly',
    };
  }

  // Fallback: treat as a keyword search
  const sanitized = trimmed.replace(/['"\\]/g, '').slice(0, 200);
  return {
    spl: `index=main earliest=-1h "*${sanitized}*" | table _time service level message | head 20`,
    interpretation: `Searching for events containing "${sanitized}"`,
  };
}

export async function POST(request: NextRequest) {
  const config = getSplunkConfig();

  if (!isConfigured(config)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Splunk is not configured. Set SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.',
        spl: null,
        results: [],
        count: 0,
        interpretation: null,
      },
      { status: 503 }
    );
  }

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', spl: null, results: [], count: 0, interpretation: null },
      { status: 400 }
    );
  }

  const { query } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Missing or empty "query" field', spl: null, results: [], count: 0, interpretation: null },
      { status: 400 }
    );
  }

  const { spl, interpretation } = convertToSPL(query);

  try {
    const results = await runQuery(spl, config);
    return NextResponse.json(
      {
        success: true,
        spl,
        results,
        count: results.length,
        interpretation,
        error: null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        spl,
        results: [],
        count: 0,
        interpretation,
        error: error instanceof Error ? error.message : 'Query execution failed',
      },
      { status: 500 }
    );
  }
}
