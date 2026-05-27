/**
 * Live Evidence Collector
 *
 * Runs SPL queries against a real Splunk instance and converts the results
 * into typed EvidenceItem[] for the investigation pipeline.
 */

import type { EvidenceItem, InvestigationQuery } from '@/types/index';
import { runQuery } from '@/lib/splunk/client';
import { getSplunkConfig } from '@/lib/splunk/config';

/**
 * Converts a raw Splunk result row into an EvidenceItem.
 * Splunk results are flat key-value objects with _time, _raw, host, source, sourcetype, etc.
 */
function splunkResultToEvidence(
  raw: unknown,
  index: number,
  queryName: string
): EvidenceItem {
  const obj = (raw !== null && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Record<string, unknown>
    : {};

  // Extract common Splunk fields
  const time = typeof obj['_time'] === 'string' ? obj['_time'] : new Date().toISOString();
  const host = typeof obj['host'] === 'string' ? obj['host'] : '';
  const source = typeof obj['source'] === 'string' ? obj['source'] : '';
  const sourcetype = typeof obj['sourcetype'] === 'string' ? obj['sourcetype'] : '';
  const rawText = typeof obj['_raw'] === 'string' ? obj['_raw'] : '';

  // Determine evidence type based on sourcetype or query context
  let type: EvidenceItem['type'] = 'log';
  if (sourcetype.includes('metric') || queryName.toLowerCase().includes('latency') || queryName.toLowerCase().includes('metric')) {
    type = 'metric';
  } else if (sourcetype.includes('trace') || sourcetype.includes('span') || queryName.toLowerCase().includes('trace')) {
    type = 'trace';
  } else if (sourcetype.includes('deploy') || queryName.toLowerCase().includes('deployment')) {
    type = 'deployment';
  }

  // Build a human-readable summary
  const level = typeof obj['level'] === 'string' ? obj['level'] : '';
  const message = typeof obj['message'] === 'string' ? obj['message'] : '';
  const service = typeof obj['service'] === 'string' ? obj['service'] : '';

  let summary: string;
  if (message) {
    summary = level ? `[${level}] ${service || source}: ${message}` : `${service || source}: ${message}`;
  } else if (rawText) {
    summary = rawText.substring(0, 200);
  } else {
    // Build summary from available fields
    const fields = Object.entries(obj)
      .filter(([k]) => !k.startsWith('_') && k !== 'host' && k !== 'source' && k !== 'sourcetype')
      .slice(0, 5)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    summary = fields || `Result from ${queryName}`;
  }

  return {
    id: `live-${queryName.replace(/\s+/g, '-').toLowerCase()}-${index + 1}`,
    type,
    timestamp: time,
    source: service || host || source || 'splunk',
    data: raw,
    summary,
  };
}

/**
 * Runs a single investigation query against Splunk and returns evidence items.
 * Returns an empty array if the query fails (logs the error but doesn't throw).
 */
async function runQuerySafe(query: InvestigationQuery): Promise<EvidenceItem[]> {
  try {
    const results = await runQuery(query.spl);
    return results.map((row, i) => splunkResultToEvidence(row, i, query.name));
  } catch (error) {
    console.error(`[LiveEvidence] Query "${query.name}" failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Collects live evidence from Splunk by running all investigation queries.
 *
 * Runs queries in parallel for speed. Each query's results are converted
 * into typed EvidenceItem objects. Failed queries are skipped gracefully.
 *
 * @param queries - The investigation queries to execute.
 * @returns A flat array of all evidence items collected from Splunk.
 */
export async function collectLiveEvidence(
  queries: InvestigationQuery[]
): Promise<EvidenceItem[]> {
  const config = getSplunkConfig();

  console.log(`[LiveEvidence] Running ${queries.length} queries against Splunk at ${config.host}:${config.port}`);

  // Run all queries in parallel
  const results = await Promise.all(queries.map(runQuerySafe));

  // Flatten all results into a single array
  const allEvidence = results.flat();

  console.log(`[LiveEvidence] Collected ${allEvidence.length} evidence items from ${queries.length} queries`);

  return allEvidence;
}

/**
 * Runs a custom SPL query and returns the raw results as evidence items.
 * Useful for ad-hoc investigation queries.
 */
export async function runCustomQuery(
  spl: string,
  queryName = 'Custom Query'
): Promise<EvidenceItem[]> {
  try {
    const results = await runQuery(spl);
    return results.map((row, i) => splunkResultToEvidence(row, i, queryName));
  } catch (error) {
    console.error(`[LiveEvidence] Custom query failed:`, error instanceof Error ? error.message : error);
    throw error;
  }
}
