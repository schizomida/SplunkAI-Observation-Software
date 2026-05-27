import type { Incident } from '@/types/index';

/**
 * In-memory incident store.
 * Shared across route handlers and accessible from tests.
 */
export const incidentStore = new Map<string, Incident>();

// Pre-load the demo incident (demo-001)
const demoIncident: Incident = {
  id: 'demo-001',
  title: 'Checkout Service Latency Spike',
  service: 'checkout-service',
  severity: 'high',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:30:00Z',
  mode: 'demo',
  description:
    'P99 checkout latency spiked from a baseline of 120ms to over 4,200ms, causing a 23% increase in cart abandonment. Redis connection pool saturation was observed alongside retry exhaustion warnings in the payment service. A deployment of payment-service v2.4.1 occurred approximately 8 minutes before incident onset. Downstream impact included elevated error rates on the order confirmation endpoint and cascading timeouts in the inventory reservation service.',
};
incidentStore.set(demoIncident.id, demoIncident);
