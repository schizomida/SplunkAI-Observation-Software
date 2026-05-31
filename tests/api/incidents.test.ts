/**
 * @jest-environment node
 */

/**
 * Integration tests for API route handlers.
 *
 * Tests import route handlers directly and call them with
 * constructed NextRequest objects to verify behavior.
 *
 * Note: The investigate and report routes now require a live Splunk connection.
 * Without SPLUNK_TOKEN and ALLOW_LIVE_SPL=true, they return 503.
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/incidents/route';
import { incidentStore } from '@/lib/splunk/incidentStore';
import { GET as GET_BY_ID } from '@/app/api/incidents/[id]/route';
import { POST as POST_INVESTIGATE } from '@/app/api/incidents/[id]/investigate/route';
import { GET as GET_REPORT } from '@/app/api/incidents/[id]/report/route';

// Helper to create a NextRequest with JSON body
function createPostRequest(body: unknown, url = 'http://localhost:3000/api/incidents'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper to create a GET NextRequest
function createGetRequest(url = 'http://localhost:3000/api/incidents'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('POST /api/incidents', () => {
  beforeEach(() => {
    incidentStore.clear();
  });

  it('creates an incident successfully with valid body', async () => {
    const body = {
      id: 'test-001',
      title: 'Test Incident',
      service: 'test-service',
      severity: 'medium',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'live',
      description: 'A test incident',
    };

    const request = createPostRequest(body);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject(body);
    expect(json.error).toBeNull();
    expect(json.timestamp).toBeDefined();
    expect(incidentStore.has('test-001')).toBe(true);
  });

  it('generates an id if not provided', async () => {
    const body = {
      title: 'No ID Incident',
      service: 'test-service',
      severity: 'low',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'live',
      description: 'Incident without id',
    };

    const request = createPostRequest(body);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.id.length).toBeGreaterThan(0);
  });

  it('returns 400 on invalid body', async () => {
    const body = {
      // Missing required fields
      title: '',
      service: '',
    };

    const request = createPostRequest(body);
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.data).toBeNull();
    expect(json.error).toBeDefined();
    expect(json.error.length).toBeGreaterThan(0);
  });
});

describe('GET /api/incidents/[id]', () => {
  beforeEach(() => {
    incidentStore.clear();
    incidentStore.set('test-001', {
      id: 'test-001',
      title: 'Test Incident',
      service: 'test-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'live',
      description: 'Test incident for testing.',
    });
  });

  it('returns the incident when found', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/test-001');
    const response = await GET_BY_ID(request, { params: { id: 'test-001' } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('test-001');
    expect(json.data.title).toBe('Test Incident');
    expect(json.error).toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/unknown-id');
    const response = await GET_BY_ID(request, { params: { id: 'unknown-id' } });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.data).toBeNull();
    expect(json.error).toBe('Incident not found');
  });
});

describe('POST /api/incidents/[id]/investigate', () => {
  beforeEach(() => {
    incidentStore.clear();
    incidentStore.set('test-001', {
      id: 'test-001',
      title: 'Test Incident',
      service: 'test-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'live',
      description: 'Test incident for testing.',
    });
  });

  it('returns 503 when Splunk is not configured', async () => {
    const request = createPostRequest({}, 'http://localhost:3000/api/incidents/test-001/investigate');
    const response = await POST_INVESTIGATE(request, { params: { id: 'test-001' } });
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Splunk connection required. Configure SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.');
  });

  it('returns 503 for unknown incident when Splunk is not configured', async () => {
    const request = createPostRequest({}, 'http://localhost:3000/api/incidents/unknown/investigate');
    const response = await POST_INVESTIGATE(request, { params: { id: 'unknown' } });
    const json = await response.json();

    // 503 takes precedence over 404 since Splunk check happens first
    expect(response.status).toBe(503);
    expect(json.success).toBe(false);
  });
});

describe('GET /api/incidents/[id]/report', () => {
  beforeEach(() => {
    incidentStore.clear();
    incidentStore.set('test-001', {
      id: 'test-001',
      title: 'Test Incident',
      service: 'test-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'live',
      description: 'Test incident for testing.',
    });
  });

  it('returns 503 when Splunk is not configured', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/test-001/report');
    const response = await GET_REPORT(request, { params: { id: 'test-001' } });
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Splunk connection required. Configure SPLUNK_TOKEN and ALLOW_LIVE_SPL=true.');
  });

  it('returns 503 for unknown incident when Splunk is not configured', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/unknown/report');
    const response = await GET_REPORT(request, { params: { id: 'unknown' } });
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.success).toBe(false);
  });
});
