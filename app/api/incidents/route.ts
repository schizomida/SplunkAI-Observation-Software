import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { IncidentSchema } from '@/lib/shared/validation';
import type { Incident, ApiResponse } from '@/lib/types';
import { incidentStore } from '@/lib/splunk/incidentStore';

/**
 * POST /api/incidents
 * Validates the request body, creates an incident, stores it in-memory,
 * and returns an ApiResponse<Incident>.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Incident>>> {
  try {
    const body = await request.json();

    // Generate an id if not provided
    if (!body.id) {
      body.id = crypto.randomUUID();
    }

    const parseResult = IncidentSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
        .join('; ');

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const incident: Incident = parseResult.data;
    incidentStore.set(incident.id, incident);

    return NextResponse.json(
      {
        success: true,
        data: incident,
        error: null,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Invalid JSON body',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
}
