/**
 * Splunk REST API client.
 *
 * Provides functions to create search jobs, poll for results, and run
 * convenience queries against the Splunk REST API.
 *
 * All network calls are server-side only — the Bearer token is never exposed
 * to the client bundle.
 */

import { SplunkConfig, getSplunkConfig, isConfigured } from './config';

// Re-export isConfigured for convenience so callers only need this module.
export { isConfigured } from './config';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Builds the base URL for the Splunk REST API. */
function baseUrl(config: SplunkConfig): string {
  return `https://${config.host}:${config.port}`;
}

/** Common headers for all Splunk REST requests. */
function authHeaders(config: SplunkConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
  };
}

/**
 * Fetch wrapper that disables TLS certificate verification for local
 * Splunk instances with self-signed certificates.
 */
async function splunkFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  // Node.js fetch supports a custom agent via the undici dispatcher,
  // but the simplest approach for Next.js server-side is to set
  // NODE_TLS_REJECT_UNAUTHORIZED at the process level.
  // We set it temporarily for each request to avoid global side effects.
  const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    return await fetch(url, options);
  } finally {
    if (originalTls === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
    }
  }
}

/**
 * Parses the `earliest=` value from an SPL string and returns the number of
 * hours it represents relative to now.  Returns `null` when no `earliest=`
 * parameter is found or when the value cannot be parsed.
 *
 * Supported formats:
 *   - Relative: `-Nh` (N hours ago), `-Nm` (N minutes ago), `-Nd` (N days ago)
 *   - Epoch integers are not validated here (treated as null / uncapped).
 */
function parseEarliestHours(spl: string): number | null {
  // Match earliest= followed by a relative time token like -24h, -30m, -2d
  const match = spl.match(/earliest\s*=\s*(-?\d+)([smhd])/i);
  if (!match) return null;

  const value = Math.abs(parseInt(match[1], 10));
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value / 3600;
    case 'm':
      return value / 60;
    case 'h':
      return value;
    case 'd':
      return value * 24;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a Splunk search job by POSTing to the REST API.
 *
 * @param spl    - The SPL search string.
 * @param config - A resolved `SplunkConfig` object.
 * @returns The job SID (search identifier) assigned by Splunk.
 * @throws If the HTTP response is not OK or the SID is missing.
 */
export async function createSearchJob(
  spl: string,
  config: SplunkConfig
): Promise<string> {
  const url = `${baseUrl(config)}/services/search/jobs`;

  const body = new URLSearchParams({
    search: spl.startsWith('search ') ? spl : `search ${spl}`,
    output_mode: 'json',
  });

  const response = await splunkFetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(config),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Splunk createSearchJob failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`
    );
  }

  const json = (await response.json()) as { sid?: string };

  if (!json.sid) {
    throw new Error('Splunk createSearchJob: response did not include a SID');
  }

  return json.sid;
}

/**
 * Polls a Splunk search job until it is done, then returns the results array.
 *
 * Polls every 1 second for up to 60 attempts (60 seconds total).
 *
 * @param sid    - The search job SID returned by `createSearchJob`.
 * @param config - A resolved `SplunkConfig` object.
 * @returns The array of result objects from the Splunk response.
 * @throws On timeout (> 60 attempts) or a non-OK HTTP response.
 */
export async function pollSearchResults(
  sid: string,
  config: SplunkConfig
): Promise<unknown[]> {
  const MAX_ATTEMPTS = 60;
  const POLL_INTERVAL_MS = 1000;

  const statusUrl = `${baseUrl(config)}/services/search/jobs/${encodeURIComponent(sid)}?output_mode=json`;
  const resultsUrl = `${baseUrl(config)}/services/search/jobs/${encodeURIComponent(sid)}/results?output_mode=json&count=0`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Wait before polling (skip on first attempt to check immediately).
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Check job status.
    const statusResponse = await splunkFetch(statusUrl, {
      headers: authHeaders(config),
    });

    if (!statusResponse.ok) {
      const text = await statusResponse.text().catch(() => '');
      throw new Error(
        `Splunk pollSearchResults status check failed: ${statusResponse.status} ${statusResponse.statusText}${text ? ` — ${text}` : ''}`
      );
    }

    const statusJson = (await statusResponse.json()) as {
      entry?: Array<{
        content?: {
          dispatchState?: string;
          isDone?: boolean;
          isFailed?: boolean;
        };
      }>;
    };

    const content = statusJson.entry?.[0]?.content;

    if (content?.isFailed) {
      throw new Error(`Splunk search job ${sid} failed`);
    }

    if (!content?.isDone) {
      // Job still running — continue polling.
      continue;
    }

    // Job is done — fetch results.
    const resultsResponse = await splunkFetch(resultsUrl, {
      headers: authHeaders(config),
    });

    if (!resultsResponse.ok) {
      const text = await resultsResponse.text().catch(() => '');
      throw new Error(
        `Splunk pollSearchResults fetch failed: ${resultsResponse.status} ${resultsResponse.statusText}${text ? ` — ${text}` : ''}`
      );
    }

    const resultsJson = (await resultsResponse.json()) as {
      results?: unknown[];
    };

    return resultsJson.results ?? [];
  }

  throw new Error(
    `Splunk pollSearchResults timed out after ${MAX_ATTEMPTS} attempts for job ${sid}`
  );
}

/**
 * Convenience function: creates a search job and polls for results.
 *
 * Enforces the `MAX_TIME_WINDOW_HOURS` cap — if the SPL contains an
 * `earliest=` parameter that exceeds the configured cap, an error is thrown
 * before any network call is made.
 *
 * @param spl    - The SPL search string.
 * @param config - Optional config; defaults to `getSplunkConfig()`.
 * @returns The array of result objects from the Splunk response.
 * @throws If the time window cap is exceeded, or on any network/API error.
 */
export async function runQuery(
  spl: string,
  config?: SplunkConfig
): Promise<unknown[]> {
  const resolvedConfig = config ?? getSplunkConfig();

  // Enforce MAX_TIME_WINDOW_HOURS cap.
  const earliestHours = parseEarliestHours(spl);
  if (
    earliestHours !== null &&
    earliestHours > resolvedConfig.maxTimeWindowHours
  ) {
    throw new Error(
      `Query time window (${earliestHours}h) exceeds the maximum allowed window of ${resolvedConfig.maxTimeWindowHours}h`
    );
  }

  // Try oneshot mode first (faster for simple queries)
  try {
    return await runOneshotQuery(spl, resolvedConfig);
  } catch {
    // Fall back to async job if oneshot fails
    const sid = await createSearchJob(spl, resolvedConfig);
    return pollSearchResults(sid, resolvedConfig);
  }
}

/**
 * Runs a query in oneshot (synchronous) mode.
 * This is faster for simple queries as it avoids the create-poll cycle.
 */
async function runOneshotQuery(
  spl: string,
  config: SplunkConfig
): Promise<unknown[]> {
  const url = `${baseUrl(config)}/services/search/jobs/export`;

  const body = new URLSearchParams({
    search: spl.startsWith('search ') ? spl : `search ${spl}`,
    output_mode: 'json',
    exec_mode: 'oneshot',
  });

  const response = await splunkFetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(config),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Oneshot query failed: ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim()) return [];

  // The export endpoint returns newline-delimited JSON
  const results: unknown[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      // Export endpoint wraps results in { result: {...} } or { results: [...] }
      if (obj.result) {
        results.push(obj.result);
      } else if (obj.results && Array.isArray(obj.results)) {
        results.push(...obj.results);
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return results;
}
