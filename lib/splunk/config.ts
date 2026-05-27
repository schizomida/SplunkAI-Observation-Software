/**
 * Splunk client configuration.
 *
 * All values are read from environment variables at call time so the function
 * remains pure and side-effect-free — no module-level reads, easy to test.
 */

export interface SplunkConfig {
  host: string;
  port: number;
  token: string;
  index: string;
  allowLiveSpl: boolean;
  maxTimeWindowHours: number;
}

/**
 * Reads Splunk configuration from environment variables and returns a typed
 * config object. Defaults are applied for every field so the app can always
 * start, even without a real Splunk instance.
 *
 * Environment variables:
 *   SPLUNK_HOST            — default: 'localhost'
 *   SPLUNK_PORT            — default: 8089
 *   SPLUNK_TOKEN           — default: ''
 *   SPLUNK_INDEX           — default: 'main'
 *   ALLOW_LIVE_SPL         — default: false  (truthy only when === 'true')
 *   MAX_TIME_WINDOW_HOURS  — default: 24
 */
export function getSplunkConfig(): SplunkConfig {
  const rawPort = process.env.SPLUNK_PORT;
  const parsedPort = rawPort !== undefined ? parseInt(rawPort, 10) : NaN;
  const port = Number.isFinite(parsedPort) ? parsedPort : 8089;

  const rawMaxHours = process.env.MAX_TIME_WINDOW_HOURS;
  const parsedMaxHours =
    rawMaxHours !== undefined ? parseInt(rawMaxHours, 10) : NaN;
  const maxTimeWindowHours = Number.isFinite(parsedMaxHours)
    ? parsedMaxHours
    : 24;

  return {
    host: process.env.SPLUNK_HOST ?? 'localhost',
    port,
    token: process.env.SPLUNK_TOKEN ?? '',
    index: process.env.SPLUNK_INDEX ?? 'main',
    allowLiveSpl: process.env.ALLOW_LIVE_SPL === 'true',
    maxTimeWindowHours,
  };
}

/**
 * Returns `true` only when the config has a non-empty token **and** live SPL
 * queries are explicitly enabled via `ALLOW_LIVE_SPL=true`.
 *
 * Use this guard before making any real Splunk API calls.
 */
export function isConfigured(config: SplunkConfig): boolean {
  return config.token.trim().length > 0 && config.allowLiveSpl;
}
