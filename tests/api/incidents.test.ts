/**
 * @jest-environment node
 */

/**
 * Integration tests for API route handlers.
 *
 * Tests import route handlers directly and call them with
 * constructed NextRequest objects to verify behavior.
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
    // Clear store but keep demo incident
    incidentStore.clear();
    incidentStore.set('demo-001', {
      id: 'demo-001',
      title: 'Checkout Service Latency Spike',
      service: 'checkout-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'demo',
      description: 'Demo incident for testing.',
    });
  });

  it('creates an incident successfully with valid body', async () => {
    const body = {
      id: 'test-001',
      title: 'Test Incident',
      service: 'test-service',
      severity: 'medium',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'demo',
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
      mode: 'demo',
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
    incidentStore.set('demo-001', {
      id: 'demo-001',
      title: 'Checkout Service Latency Spike',
      service: 'checkout-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'demo',
      description: 'Demo incident for testing.',
    });
  });

  it('returns the incident when found', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/demo-001');
    const response = await GET_BY_ID(request, { params: { id: 'demo-001' } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('demo-001');
    expect(json.data.title).toBe('Checkout Service Latency Spike');
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
    incidentStore.set('demo-001', {
      id: 'demo-001',
      title: 'Checkout Service Latency Spike',
      service: 'checkout-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'demo',
      description: 'Demo incident for testing.',
    });
  });

  it('returns investigation result for demo incident', async () => {
    const request = createPostRequest({}, 'http://localhost:3000/api/incidents/demo-001/investigate');
    const response = await POST_INVESTIGATE(request, { params: { id: 'demo-001' } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.incidentId).toBe('demo-001');
    expect(json.data.queries).toBeDefined();
    expect(json.data.queries.length).toBe(12);
    expect(json.data.evidence).toBeDefined();
    expect(json.data.evidence.length).toBeGreaterThan(0);
    expect(json.data.hypotheses).toBeDefined();
    expect(json.data.remediation).toBeDefined();
    expect(json.data.analyzedAt).toBeDefined();
  });

  it('returns 404 for unknown incident', async () => {
    const request = createPostRequest({}, 'http://localhost:3000/api/incidents/unknown/investigate');
    const response = await POST_INVESTIGATE(request, { params: { id: 'unknown' } });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Incident not found');
  });

  it('returns 200 for live mode incident (falls back to demo if Splunk unavailable)', async () => {
    incidentStore.set('live-001', {
      id: 'live-001',
      title: 'Live Incident',
      service: 'live-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'live',
      description: 'A live mode incident.',
    });

    const request = createPostRequest({}, 'http://localhost:3000/api/incidents/live-001/investigate');
    const response = await POST_INVESTIGATE(request, { params: { id: 'live-001' } });
    const json = await response.json();

    // Live mode now attempts Splunk and falls back to demo data gracefully
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.incidentId).toBe('live-001');
    expect(json.data.evidence).toBeDefined();
  });
});

describe('GET /api/incidents/[id]/report', () => {
  beforeEach(() => {
    incidentStore.clear();
    incidentStore.set('demo-001', {
      id: 'demo-001',
      title: 'Checkout Service Latency Spike',
      service: 'checkout-service',
      severity: 'high',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T10:30:00Z',
      mode: 'demo',
      description: 'Demo incident for testing.',
    });
  });

  it('returns the report for a known incident', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/demo-001/report');
    const response = await GET_REPORT(request, { params: { id: 'demo-001' } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.incidentId).toBe('demo-001');
    expect(json.data.sections).toBeDefined();
    expect(json.data.sections.length).toBe(6);
    expect(json.data.markdown).toBeDefined();
    expect(json.data.markdown).toContain('Checkout Service Latency Spike');
    expect(json.data.generatedAt).toBeDefined();
  });

  it('returns 404 for unknown incident', async () => {
    const request = createGetRequest('http://localhost:3000/api/incidents/unknown/report');
    const response = await GET_REPORT(request, { params: { id: 'unknown' } });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Incident not found');
  });
});
