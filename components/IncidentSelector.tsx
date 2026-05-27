'use client';

import { useState } from 'react';
import type { Incident, Severity } from '@/types/index';

const DEMO_INCIDENT: Incident = {
  id: 'demo-001',
  title: 'Checkout Service Latency Spike',
  service: 'checkout-service',
  severity: 'high',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:30:00Z',
  mode: 'demo',
  description:
    'P99 checkout latency spiked from 120ms to over 4,200ms, causing a 23% increase in cart abandonment.',
};

interface IncidentSelectorProps {
  onSelect: (incident: Incident) => void;
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-yellow-400 text-black';
    case 'low':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

export default function IncidentSelector({ onSelect }: IncidentSelectorProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [service, setService] = useState('');
  const [severity, setSeverity] = useState<Severity>('high');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmitLive(e: React.FormEvent) {
    e.preventDefault();

    const incident: Incident = {
      id: `live-${Date.now()}`,
      title: title || `${service} Investigation`,
      service,
      severity,
      startTime: startTime ? new Date(startTime).toISOString() : new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: endTime ? new Date(endTime).toISOString() : new Date().toISOString(),
      mode: 'live',
      description: description || `Live investigation of ${service}`,
    };

    onSelect(incident);
  }

  // Pre-fill with "last 30 minutes" for convenience
  function handleQuickLive() {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const incident: Incident = {
      id: `live-${Date.now()}`,
      title: `Live Investigation — All Services`,
      service: 'main',
      severity: 'high',
      startTime: thirtyMinAgo.toISOString(),
      endTime: now.toISOString(),
      mode: 'live',
      description: 'Live investigation using real Splunk data from the last 30 minutes.',
    };

    onSelect(incident);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Live Splunk Section */}
      <div className="border border-green-200 rounded-lg p-6 shadow-sm bg-green-50">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900">
            Live Splunk Investigation
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Query your real Splunk instance for live observability data.
        </p>

        <button
          onClick={handleQuickLive}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors mb-3"
        >
          🔍 Investigate Last 30 Minutes
        </button>

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full py-2 px-4 border border-green-300 hover:bg-green-100 text-green-800 font-medium rounded-md transition-colors text-sm"
        >
          {showForm ? 'Hide Custom Form' : 'Custom Investigation...'}
        </button>

        {showForm && (
          <form onSubmit={handleSubmitLive} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Service Name</label>
              <input
                type="text"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g., checkout-service, payment-api"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Latency Spike Investigation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you investigating?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors"
            >
              Start Live Investigation
            </button>
          </form>
        )}
      </div>

      {/* Demo Section */}
      <div className="border border-gray-200 rounded-lg p-6 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {DEMO_INCIDENT.title}
          </h3>
          <span
            className={`px-2 py-1 rounded text-xs font-medium uppercase ${severityColor(DEMO_INCIDENT.severity)}`}
          >
            {DEMO_INCIDENT.severity}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <p>
            <span className="font-medium text-gray-700">Service:</span>{' '}
            {DEMO_INCIDENT.service}
          </p>
          <p>
            <span className="font-medium text-gray-700">Time Window:</span>{' '}
            {new Date(DEMO_INCIDENT.startTime).toLocaleString()} &mdash;{' '}
            {new Date(DEMO_INCIDENT.endTime).toLocaleString()}
          </p>
          <p className="text-gray-500">{DEMO_INCIDENT.description}</p>
        </div>

        <button
          onClick={() => onSelect(DEMO_INCIDENT)}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors"
        >
          Use Demo Incident
        </button>
      </div>
    </div>
  );
}
