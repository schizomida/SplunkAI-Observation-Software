import { NextRequest, NextResponse } from 'next/server';
import type { Incident, ApiResponse } from '@/types/index';
import { incidentStore } from '@/lib/incidentStore';

/**
 * GET /api/incidents/[id]
 * Looks up an incident by id from the in-memory store.
 * Returns 404 if not found.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse<Incident>>> {
  const { id } = params;

  // Input validation: id must be a non-empty string with reasonable length
  if (!id || id.length > 128) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Invalid incident id',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const incident = incidentStore.get(id);

  if (!incident) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: 'Incident not found',
        timestamp: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: incident,
      error: null,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
