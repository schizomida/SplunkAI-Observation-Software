import { NextResponse } from 'next/server';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';

interface HealthResponse {
  connected: boolean;
  version: string;
  indexes: number;
  mltkInstalled: boolean;
}

/**
 * GET /api/splunk/health
 *
 * Health check endpoint that verifies Splunk connectivity.
 * Returns connection status, Splunk version, index count, and MLTK status.
 */
export async function GET() {
  const config = getSplunkConfig();

  if (!isConfigured(config)) {
    const response: HealthResponse = {
      connected: false,
      version: 'N/A',
      indexes: 0,
      mltkInstalled: false,
    };
    return NextResponse.json(response, { status: 200 });
  }

  const baseUrl = `https://${config.host}:${config.port}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
  };

  // Temporarily disable TLS verification for self-signed certs
  const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    // Check server info for version
    const serverInfoRes = await fetch(
      `${baseUrl}/services/server/info?output_mode=json`,
      { headers }
    );

    if (!serverInfoRes.ok) {
      return NextResponse.json(
        { connected: false, version: 'N/A', indexes: 0, mltkInstalled: false } as HealthResponse,
        { status: 200 }
      );
    }

    const serverInfo = (await serverInfoRes.json()) as {
      entry?: Array<{ content?: { version?: string } }>;
    };
    const version = serverInfo.entry?.[0]?.content?.version ?? 'unknown';

    // Check indexes
    let indexCount = 0;
    try {
      const indexRes = await fetch(
        `${baseUrl}/services/data/indexes?output_mode=json&count=0`,
        { headers }
      );
      if (indexRes.ok) {
        const indexData = (await indexRes.json()) as { entry?: unknown[] };
        indexCount = indexData.entry?.length ?? 0;
      }
    } catch {
      // Non-critical — just report 0
    }

    // Check if MLTK is installed
    let mltkInstalled = false;
    try {
      const appsRes = await fetch(
        `${baseUrl}/services/apps/local?output_mode=json&count=0`,
        { headers }
      );
      if (appsRes.ok) {
        const appsData = (await appsRes.json()) as {
          entry?: Array<{ name?: string }>;
        };
        mltkInstalled = appsData.entry?.some(
          (app) => app.name === 'Splunk_ML_Toolkit' || app.name === 'mltk'
        ) ?? false;
      }
    } catch {
      // Non-critical
    }

    const response: HealthResponse = {
      connected: true,
      version,
      indexes: indexCount,
      mltkInstalled,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[SplunkHealth] Health check failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { connected: false, version: 'N/A', indexes: 0, mltkInstalled: false } as HealthResponse,
      { status: 200 }
    );
  } finally {
    if (originalTls === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
    }
  }
}
