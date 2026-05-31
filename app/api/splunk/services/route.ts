import { NextResponse } from 'next/server';
import { getSplunkConfig, isConfigured } from '@/lib/splunk/config';
import { runQuery } from '@/lib/splunk/client';

/**
 * GET /api/splunk/services
 * Fetches available service names from Splunk by running:
 *   index=main | stats count by service | sort -count | head 50
 * Returns: { services: string[] }
 */
export async function GET() {
  const config = getSplunkConfig();

  if (!isConfigured(config)) {
    return NextResponse.json(
      { services: [], error: 'Splunk not configured' },
      { status: 503 }
    );
  }

  try {
    const results = await runQuery(
      'index=main earliest=-24h | stats count by service | sort -count | head 50',
      config
    );

    const services: string[] = [];
    if (Array.isArray(results)) {
      for (const row of results) {
        const record = row as Record<string, unknown>;
        const svc = record.service;
        if (svc && typeof svc === 'string' && svc.trim().length > 0) {
          services.push(svc.trim());
        }
      }
    }

    return NextResponse.json({ services }, { status: 200 });
  } catch (error) {
    console.error('[Services] Failed to fetch services from Splunk:', error);
    return NextResponse.json(
      { services: [], error: 'Failed to fetch services from Splunk' },
      { status: 500 }
    );
  }
}
