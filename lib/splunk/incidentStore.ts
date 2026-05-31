import type { Incident } from '@/lib/types';

/**
 * In-memory incident store.
 * Shared across route handlers and accessible from tests.
 * Starts empty — incidents are registered when investigations begin.
 */
export const incidentStore = new Map<string, Incident>();
