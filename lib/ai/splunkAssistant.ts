/**
 * Splunk AI Assistant Integration
 *
 * Provides integration with Splunk AI Assistant (cloud-connected) for:
 * - Natural language to SPL generation
 * - SPL query explanation
 * - AI-powered root cause suggestions
 * - Investigation summarization
 *
 * When the cloud token is not configured, all functions return null,
 * allowing callers to fall back to OpenAI or rule-based approaches.
 */

export interface SplunkAIConfig {
  proxyUrl: string;  // The proxy server URL for Splunk AI Assistant
  cloudToken: string; // Splunk cloud auth token
  enabled: boolean;
}

/**
 * Reads Splunk AI Assistant configuration from environment variables.
 * The assistant is only enabled when both the proxy URL and cloud token are set.
 */
export function getSplunkAIConfig(): SplunkAIConfig {
  return {
    proxyUrl: process.env.SPLUNK_AI_PROXY_URL || '',
    cloudToken: process.env.SPLUNK_AI_CLOUD_TOKEN || '',
    enabled: !!(process.env.SPLUNK_AI_PROXY_URL && process.env.SPLUNK_AI_CLOUD_TOKEN),
  };
}

/**
 * Internal helper to make authenticated requests to the Splunk AI Assistant proxy.
 */
async function callSplunkAI(
  endpoint: string,
  body: Record<string, unknown>
): Promise<unknown | null> {
  const config = getSplunkAIConfig();
  if (!config.enabled) return null;

  try {
    const response = await fetch(`${config.proxyUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.cloudToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(
        `[SplunkAI] Request to ${endpoint} failed: ${response.status} ${response.statusText}`
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(
      '[SplunkAI] Request failed:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Generate SPL from natural language using Splunk AI Assistant.
 *
 * @param query - Natural language description of the desired search.
 * @returns The generated SPL string, or null if the assistant is unavailable.
 */
export async function generateSPLFromNaturalLanguage(
  query: string
): Promise<string | null> {
  const result = await callSplunkAI('/api/v1/generate-spl', {
    query,
    context: {
      indexes: ['main'],
      sourcetypes: ['app_logs', 'app_metrics', 'app_traces', 'deployment'],
    },
  });

  if (result && typeof result === 'object' && 'spl' in result) {
    return String((result as Record<string, unknown>).spl);
  }

  return null;
}

/**
 * Explain an SPL query in plain English using Splunk AI Assistant.
 *
 * @param spl - The SPL query to explain.
 * @returns A human-readable explanation, or null if the assistant is unavailable.
 */
export async function explainSPL(spl: string): Promise<string | null> {
  const result = await callSplunkAI('/api/v1/explain-spl', {
    spl,
  });

  if (result && typeof result === 'object' && 'explanation' in result) {
    return String((result as Record<string, unknown>).explanation);
  }

  return null;
}

/**
 * Get AI-powered root cause suggestion from Splunk AI Assistant.
 *
 * @param context - The investigation context including incident details, evidence, and metrics.
 * @returns An AI-generated root cause suggestion, or null if the assistant is unavailable.
 */
export async function getAIRootCauseSuggestion(context: {
  incident: unknown;
  evidence: unknown[];
  metrics: unknown[];
}): Promise<string | null> {
  const result = await callSplunkAI('/api/v1/root-cause', {
    incident: context.incident,
    evidence: context.evidence,
    metrics: context.metrics,
  });

  if (result && typeof result === 'object' && 'suggestion' in result) {
    return String((result as Record<string, unknown>).suggestion);
  }

  return null;
}

/**
 * Summarize investigation findings using Splunk AI Assistant.
 *
 * @param investigationData - The full investigation data to summarize.
 * @returns An AI-generated summary, or null if the assistant is unavailable.
 */
export async function summarizeWithSplunkAI(
  investigationData: unknown
): Promise<string | null> {
  const result = await callSplunkAI('/api/v1/summarize', {
    investigation: investigationData,
  });

  if (result && typeof result === 'object' && 'summary' in result) {
    return String((result as Record<string, unknown>).summary);
  }

  return null;
}
