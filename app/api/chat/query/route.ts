import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

/**
 * POST /api/chat/query
 *
 * Conversational AI endpoint for the "Ask Splunk Assistant" tab.
 * Accepts: { query: string, history?: Array<{role: string, content: string}> }
 * Returns: { success: boolean, answer: string, spl?: string, results?: unknown[], count?: number }
 */

interface ConversationMessage {
  role: string;
  content: string;
}

interface QueryMapping {
  patterns: RegExp[];
  spl: string;
  answerTemplate: (count: number, results: unknown[]) => string;
}

const QUERY_MAPPINGS: QueryMapping[] = [
  {
    patterns: [/error/i, /fail/i, /crash/i, /broke/i],
    spl: 'index=main level=ERROR earliest=-7d | stats count by service message | sort -count | head 10',
    answerTemplate: (count, results) => {
      if (count === 0) return 'Good news — no errors detected in the recent time window. Your services appear healthy.';
      const top = results[0] as Record<string, string> | undefined;
      return `I found ${count} error pattern${count !== 1 ? 's' : ''}. The most frequent is "${top?.message || 'unknown'}" from ${top?.service || 'unknown service'} (${top?.count || '?'} occurrences). This suggests a recurring issue that may need attention.`;
    },
  },
  {
    patterns: [/latency/i, /slow/i, /performance/i, /duration/i, /speed/i],
    spl: 'index=main sourcetype=app_traces earliest=-7d | stats avg(durationMs) as avg_ms p99(durationMs) as p99_ms by service | sort -p99_ms',
    answerTemplate: (count, results) => {
      if (count === 0) return 'No trace data available to measure latency. Make sure app_traces sourcetype is being ingested.';
      const top = results[0] as Record<string, string> | undefined;
      return `Across ${count} service${count !== 1 ? 's' : ''}, the highest p99 latency is ${top?.p99_ms || '?'}ms from ${top?.service || 'unknown'}. Average is ${top?.avg_ms || '?'}ms. ${Number(top?.p99_ms) > 2000 ? 'This is elevated — consider investigating the slow spans.' : 'Latency looks within normal range.'}`;
    },
  },
  {
    patterns: [/deploy/i, /release/i, /version/i, /ship/i],
    spl: 'index=main sourcetype=deployment earliest=-7d | table _time service version previousVersion changeDescription | sort -_time | head 10',
    answerTemplate: (count, results) => {
      if (count === 0) return 'No deployment events found in the last 7 days.';
      const latest = results[0] as Record<string, string> | undefined;
      return `There have been ${count} deployment${count !== 1 ? 's' : ''} in the last 7 days. The most recent was ${latest?.service || 'unknown'} ${latest?.version || ''} — "${latest?.changeDescription || 'no description'}".`;
    },
  },
  {
    patterns: [/service/i, /affected/i, /which/i, /health/i, /status/i],
    spl: 'index=main earliest=-7d | stats count as events count(eval(level="ERROR")) as errors by service | eval error_pct=round(errors/events*100,1) | sort -error_pct',
    answerTemplate: (count, results) => {
      if (count === 0) return 'No service data available. Check that events have a "service" field.';
      const worst = results[0] as Record<string, string> | undefined;
      return `${count} service${count !== 1 ? 's' : ''} are reporting data. ${worst?.service || 'Unknown'} has the highest error rate at ${worst?.error_pct || '0'}% (${worst?.errors || '0'} errors out of ${worst?.events || '0'} events). ${Number(worst?.error_pct) > 5 ? 'This service needs immediate attention.' : 'Error rates look acceptable.'}`;
    },
  },
  {
    patterns: [/anomal/i, /spike/i, /unusual/i, /surge/i, /weird/i],
    spl: 'index=main earliest=-7d | timechart span=1h count by level | where ERROR > 5',
    answerTemplate: (count, results) => {
      if (count === 0) return 'No significant anomalies detected. Event volumes appear stable with no unusual error spikes.';
      return `I detected ${count} time window${count !== 1 ? 's' : ''} with elevated error counts (>5 errors per hour). This could indicate periodic issues or a recurring pattern worth investigating.`;
    },
  },
  {
    patterns: [/timeout/i, /connection/i, /network/i, /refused/i],
    spl: 'index=main (*timeout* OR *refused* OR *ETIMEDOUT*) earliest=-7d | stats count by service message | sort -count | head 10',
    answerTemplate: (count, results) => {
      if (count === 0) return 'No timeout or connection issues found. Network connectivity appears healthy.';
      const top = results[0] as Record<string, string> | undefined;
      return `Found ${count} patterns of connection issues. The most common is "${top?.message || 'unknown'}" from ${top?.service || 'unknown'} (${top?.count || '?'} times). This may indicate downstream dependency problems.`;
    },
  },
  {
    patterns: [/summarize/i, /summary/i, /overview/i, /situation/i, /what.s happening/i, /tell me/i],
    spl: 'index=main earliest=-7d | stats count as total count(eval(level="ERROR")) as errors count(eval(level="WARN")) as warnings dc(service) as services | eval error_rate=round(errors/total*100,1)',
    answerTemplate: (count, results) => {
      const row = results[0] as Record<string, string> | undefined;
      if (!row) return 'Unable to generate a summary — no data available in the current time window.';
      return `Here's your situation: ${row.total || '0'} total events across ${row.services || '0'} services in the last 7 days. Error rate is ${row.error_rate || '0'}% (${row.errors || '0'} errors, ${row.warnings || '0'} warnings). ${Number(row.error_rate) > 5 ? 'Error rate is elevated — recommend investigation.' : 'Things look relatively stable.'}`;
    },
  },
];

function matchQuery(query: string): QueryMapping | null {
  for (const mapping of QUERY_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(query)) return mapping;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: { query?: string; history?: ConversationMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = body.query || '';
  if (!query.trim()) {
    return NextResponse.json({ success: false, error: 'Empty query' }, { status: 400 });
  }

  const config = getSplunkConfig();
  if (!isConfigured(config)) {
    return NextResponse.json({
      success: true,
      answer: 'Splunk is not connected. Please configure SPLUNK_TOKEN and ALLOW_LIVE_SPL=true to enable live queries.',
      spl: null,
      results: [],
      count: 0,
    });
  }

  const mapping = matchQuery(query);

  if (!mapping) {
    // Fallback: keyword search
    const sanitized = query.replace(/['"\\]/g, '').slice(0, 100);
    const fallbackSpl = `index=main earliest=-7d "*${sanitized}*" | stats count by service level | sort -count | head 10`;

    try {
      const results = await runQuery(fallbackSpl, config);
      const answer = results.length > 0
        ? `I searched for "${sanitized}" and found matches across ${results.length} service/level combinations. Let me know if you'd like me to dig deeper into any specific service.`
        : `I couldn't find events matching "${sanitized}" in the last 7 days. Try asking about errors, latency, deployments, or service health.`;

      return NextResponse.json({
        success: true,
        answer,
        spl: fallbackSpl,
        results: results.slice(0, 10),
        count: results.length,
      });
    } catch (err) {
      return NextResponse.json({
        success: true,
        answer: `I tried searching for "${sanitized}" but the query failed. This might be a syntax issue. Try asking in a different way, like "show me errors" or "what's the latency?"`,
        error: err instanceof Error ? err.message : 'Query failed',
      });
    }
  }

  try {
    const results = await runQuery(mapping.spl, config);
    const answer = mapping.answerTemplate(results.length, results);

    return NextResponse.json({
      success: true,
      answer,
      spl: mapping.spl,
      results: results.slice(0, 10),
      count: results.length,
    });
  } catch (err) {
    return NextResponse.json({
      success: true,
      answer: 'I encountered an issue running that query against Splunk. The connection may be slow or the query timed out. Try again or rephrase your question.',
      spl: mapping.spl,
      error: err instanceof Error ? err.message : 'Query failed',
    });
  }
}
