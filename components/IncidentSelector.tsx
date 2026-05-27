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
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          AI-Powered Incident Investigation
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to SignalSage
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Select an incident to begin automated root cause analysis. SignalSage will query Splunk,
          analyze evidence, and generate actionable remediation steps.
        </p>
      </div>

      {/* Live Splunk Section */}
      <div className="relative overflow-hidden rounded-xl border-2 border-green-200 p-6 shadow-sm bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
              <span className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 pulse-ring" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Live Splunk Investigation
            </h3>
            <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
              LIVE
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Connect to your real Splunk instance and investigate live observability data in real-time.
          </p>

          <button
            onClick={handleQuickLive}
            className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <span>🔍</span>
            <span>Investigate Last 30 Minutes</span>
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full mt-3 py-2 px-4 border border-green-300 hover:bg-green-50 text-green-800 font-medium rounded-lg transition-all duration-200 text-sm"
          >
            {showForm ? '▲ Hide Custom Form' : '▼ Custom Investigation...'}
          </button>

          {showForm && (
            <form onSubmit={handleSubmitLive} className="mt-4 space-y-3 animate-fade-in-up">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Service Name</label>
                <input
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="e.g., checkout-service, payment-api"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-smooth"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-smooth"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-smooth"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-smooth"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-smooth"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-smooth"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm"
              >
                Start Live Investigation
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">or try a demo</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Demo Section */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 p-6 shadow-sm bg-gradient-to-br from-white via-white to-indigo-50 card-hover">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {DEMO_INCIDENT.title}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Pre-loaded synthetic data — no Splunk connection needed</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${severityColor(DEMO_INCIDENT.severity)}`}
            >
              {DEMO_INCIDENT.severity}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 block">Service</span>
              <span className="font-medium text-gray-900">{DEMO_INCIDENT.service}</span>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 block">Duration</span>
              <span className="font-medium text-gray-900">30 minutes</span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4 leading-relaxed">{DEMO_INCIDENT.description}</p>

          <button
            onClick={() => onSelect(DEMO_INCIDENT)}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <span>🔮</span>
            <span>Run Demo Investigation</span>
          </button>
        </div>
      </div>
    </div>
  );
}
