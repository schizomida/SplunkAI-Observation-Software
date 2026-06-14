/**
 * Natural Language to SPL translator.
 *
 * Uses keyword/pattern matching and templates to convert plain English
 * questions about Splunk data into valid SPL queries. No LLM required —
 * deterministic and instant.
 */

interface NLPattern {
  /** Keywords that trigger this pattern (checked case-insensitively). */
  keywords: string[];
  /** The SPL template to produce. */
  spl: string;
  /** Plain English explanation of what the query does. */
  explanation: string;
}

const PATTERNS: NLPattern[] = [
  {
    keywords: ['error', 'errors', 'failed', 'failure', 'failures', 'exception'],
    spl: 'index=main level=ERROR earliest=-1h | stats count by service message | sort -count | head 20',
    explanation:
      'Searches for ERROR-level events in the last hour, grouped by service and message, sorted by frequency.',
  },
  {
    keywords: ['timeout', 'timeouts', 'etimedout', 'timed out'],
    spl: 'index=main (*timeout* OR *ETIMEDOUT*) earliest=-1h | stats count by service | sort -count',
    explanation:
      'Finds timeout-related events in the last hour and counts them per service.',
  },
  {
    keywords: ['deploy', 'deployment', 'deployments', 'deployed', 'release', 'released'],
    spl: 'index=main sourcetype=deployment earliest=-24h | table _time service version previousVersion changeDescription | sort -_time',
    explanation:
      'Lists deployments from the last 24 hours with version info and change descriptions.',
  },
  {
    keywords: ['latency', 'slow', 'performance', 'response time', 'duration'],
    spl: 'index=main sourcetype=app_traces earliest=-1h | stats avg(durationMs) as avg_latency p99(durationMs) as p99 by service | sort -p99',
    explanation:
      'Calculates average and p99 latency per service from trace data in the last hour.',
  },
  {
    keywords: ['service', 'services', 'health', 'status'],
    spl: 'index=main earliest=-1h | stats count(eval(level="ERROR")) as errors count as total by service | eval health=if(errors/total > 0.1, "critical", if(errors/total > 0.05, "degraded", "healthy")) | sort -errors',
    explanation:
      'Evaluates the health of each service based on error rate: >10% critical, >5% degraded, otherwise healthy.',
  },
  {
    keywords: ['cpu', 'memory', 'utilization', 'resource', 'resources'],
    spl: 'index=main sourcetype=app_metrics earliest=-1h metric_name=*cpu* OR metric_name=*memory* | stats avg(value) max(value) by metric_name | sort -avg(value)',
    explanation:
      'Shows average and max CPU/memory utilization metrics from the last hour.',
  },
  {
    keywords: ['database', 'db', 'query', 'queries', 'sql'],
    spl: 'index=main sourcetype=app_traces earliest=-1h (*database* OR *db* OR *sql*) | stats avg(durationMs) as avg_ms count by service | sort -avg_ms | head 20',
    explanation:
      'Finds database-related operations and their average duration per service.',
  },
  {
    keywords: ['spike', 'surge', 'anomaly', 'unusual', 'abnormal'],
    spl: 'index=main earliest=-1h | timechart span=5m count by level | where count > 0',
    explanation:
      'Charts event volume over time by severity level to help spot spikes or anomalies.',
  },
  {
    keywords: ['log', 'logs', 'events', 'recent', 'latest'],
    spl: 'index=main earliest=-15m | head 50 | table _time service level message',
    explanation: 'Shows the 50 most recent log events from the last 15 minutes.',
  },
  {
    keywords: ['alert', 'alerts', 'warning', 'warnings'],
    spl: 'index=main (level=WARN OR level=WARNING) earliest=-1h | stats count by service message | sort -count | head 20',
    explanation: 'Finds warning-level events from the last hour, grouped by service.',
  },
];

/**
 * Translates a natural language question into an SPL query.
 *
 * Returns the SPL string and a plain English explanation, or `null` if the
 * question could not be matched to any known pattern.
 */
export function translateNLToSPL(
  query: string
): { spl: string; explanation: string } | null {
  if (!query || query.trim().length === 0) {
    return null;
  }

  const lower = query.toLowerCase();

  // Score each pattern by how many keywords match
  let bestMatch: NLPattern | null = null;
  let bestScore = 0;

  for (const pattern of PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  // If we found a match, use it
  if (bestMatch && bestScore > 0) {
    return {
      spl: bestMatch.spl,
      explanation: bestMatch.explanation,
    };
  }

  // Fallback: extract meaningful keywords and do a generic search
  const stopWords = new Set([
    'show', 'me', 'the', 'all', 'find', 'get', 'what', 'which', 'where',
    'when', 'how', 'many', 'much', 'is', 'are', 'was', 'were', 'has', 'have',
    'had', 'do', 'does', 'did', 'a', 'an', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'from', 'by', 'about', 'that', 'this', 'it', 'they',
    'them', 'their', 'my', 'our', 'can', 'could', 'would', 'should',
    'will', 'shall', 'may', 'might', 'last', 'hour', 'today', 'yesterday',
  ]);

  const keywords = lower
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) {
    return null;
  }

  const searchTerms = keywords.slice(0, 5).join(' OR *');
  return {
    spl: `index=main earliest=-1h *${searchTerms}* | head 20 | table _time service level message`,
    explanation: `Searches for events containing "${keywords.join(', ')}" in the last hour.`,
  };
}
