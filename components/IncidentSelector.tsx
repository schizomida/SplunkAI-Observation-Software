'use client';

import { useState, useEffect, useRef } from 'react';
import type { Incident, Severity } from '@/lib/types';
import { playClickSound } from '@/lib/sounds';

const SEVERITY_OPTIONS: Severity[] = ['low', 'medium', 'high', 'critical'];

const KNOWN_SERVICES = [
  { label: 'All Services', value: '*' },
  { label: 'checkout-service', value: 'checkout-service' },
  { label: 'inventory-service', value: 'inventory-service' },
  { label: 'notification-service', value: 'notification-service' },
  { label: 'user-auth', value: 'user-auth' },
  { label: 'payment-api', value: 'payment-api' },
  { label: 'payment-service', value: 'payment-service' },
  { label: 'order-confirmation-service', value: 'order-confirmation-service' },
];

const SOURCETYPE_OPTIONS = [
  'All',
  'app_logs',
  'app_metrics',
  'app_traces',
  'deployment',
  'access_combined',
  'syslog',
  'WinEventLog',
  'linux_secure',
  'apache_error',
  'nginx_access',
  'docker_events',
  'kubernetes_events',
  'aws_cloudwatch',
  'azure_monitor',
  'gcp_logging',
  'splunkd',
  'metrics_csv',
  'json_events',
  'custom',
];

const QUICK_TIME_RANGES = [
  { label: '48 Hours', minutes: 48 * 60 },
  { label: '4 Days', minutes: 4 * 24 * 60 },
  { label: '8 Days', minutes: 8 * 24 * 60 },
  { label: '16 Days', minutes: 16 * 24 * 60 },
  { label: '32 Days', minutes: 32 * 24 * 60 },
  { label: '64 Days', minutes: 64 * 24 * 60 },
  { label: '128 Days', minutes: 128 * 24 * 60 },
  { label: '256 Days', minutes: 256 * 24 * 60 },
];

interface IncidentSelectorProps {
  onSelect: (incident: Incident) => void;
}

export default function IncidentSelector({ onSelect }: IncidentSelectorProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [service, setService] = useState(KNOWN_SERVICES[0].value);
  const [customService, setCustomService] = useState('');
  const [severity, setSeverity] = useState<Severity>('high');
  const [selectedSeverities, setSelectedSeverities] = useState<Severity[]>(['high', 'critical']);
  const [allSeverityLevels, setAllSeverityLevels] = useState(false);
  const [sourcetypeFilter, setSourcetypeFilter] = useState('All');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');

  // Refs for datetime pickers
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  // Dynamic service list from Splunk — initialized with hardcoded fallback
  const [availableServices, setAvailableServices] = useState<Array<{ label: string; value: string }>>(KNOWN_SERVICES);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [showCustomService, setShowCustomService] = useState(false);

  // Try to fetch from Splunk in background to update the list
  useEffect(() => {
    async function fetchServices() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch('/api/splunk/services', { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data.services && data.services.length > 0) {
            const fetched = [
              { label: 'All Services', value: '*' },
              ...data.services.map((svc: string) => ({ label: svc, value: svc })),
            ];
            setAvailableServices(fetched);
            setService('*');
          }
        }
      } catch {
        // Splunk not available or timeout — keep using hardcoded list
      }
    }
    fetchServices();
  }, []);

  function handleQuickTimeRange(minutes: number) {
    playClickSound();
    const now = new Date();
    const start = new Date(now.getTime() - minutes * 60 * 1000);
    setStartTime(start.toISOString().slice(0, 16));
    setEndTime(now.toISOString().slice(0, 16));
  }

  function toggleSeverity(sev: Severity) {
    playClickSound();
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  }

  function handleServiceChange(value: string) {
    if (value === '__custom__') {
      setShowCustomService(true);
      setService('');
    } else {
      setShowCustomService(false);
      setService(value);
    }
  }

  function getEffectiveService(): string {
    return showCustomService ? customService : service;
  }

  function handleSubmitLive(e: React.FormEvent) {
    e.preventDefault();
    playClickSound();

    const effectiveSeverities = allSeverityLevels ? SEVERITY_OPTIONS : selectedSeverities;
    const highestSeverity = effectiveSeverities.includes('critical')
      ? 'critical'
      : effectiveSeverities.includes('high')
        ? 'high'
        : effectiveSeverities.includes('medium')
          ? 'medium'
          : 'low';

    const effectiveService = getEffectiveService();

    const incident: Incident = {
      id: `live-${Date.now()}`,
      title: title || `${effectiveService === '*' ? 'All Services' : effectiveService} Investigation`,
      service: effectiveService,
      severity: highestSeverity,
      startTime: startTime ? new Date(startTime).toISOString() : new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: endTime ? new Date(endTime).toISOString() : new Date().toISOString(),
      mode: 'live',
      description: description || `Live investigation of ${effectiveService === '*' ? 'all services' : effectiveService}${sourcetypeFilter !== 'All' ? ` (sourcetype: ${sourcetypeFilter})` : ''} — severity: ${effectiveSeverities.join(', ')}`,
    };

    onSelect(incident);
  }

  function handleQuickLive() {
    playClickSound();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const incident: Incident = {
      id: `live-${Date.now()}`,
      title: `Live Investigation — All Services`,
      service: '*',
      severity: 'high',
      startTime: thirtyDaysAgo.toISOString(),
      endTime: now.toISOString(),
      mode: 'live',
      description: 'Live investigation using real Splunk data from the last 30 days.',
    };

    onSelect(incident);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center py-6 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI-Powered Incident Investigation
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Configure Your Investigation
        </h2>
        <p className="text-white/60 max-w-md mx-auto">
          Connect to your live Splunk instance and investigate real observability data.
          SignalSage will query Splunk, analyze evidence, and generate actionable remediation steps.
        </p>
      </div>

      {/* Live Splunk Section */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 p-6 shadow-sm bg-white/5 backdrop-blur-xl animate-fade-in-up">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
              <span className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 pulse-ring" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Live Splunk Investigation
            </h3>
            <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              LIVE
            </span>
          </div>
          <p className="text-sm text-white/60 mb-5">
            Connect to your real Splunk instance and investigate live observability data in real-time.
          </p>

          <button
            onClick={handleQuickLive}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 btn-press"
          >
            <span>🔍</span>
            <span>Investigate Last 30 Days</span>
          </button>

          <button
            onClick={() => { playClickSound(); setShowForm(!showForm); }}
            className="w-full mt-3 py-2 px-4 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 font-medium rounded-lg transition-all duration-200 text-sm btn-press"
          >
            {showForm ? '▲ Hide Custom Form' : '▼ Custom Investigation...'}
          </button>

          {showForm && (
            <form onSubmit={handleSubmitLive} className="mt-4 space-y-3 animate-fade-in-up">
              {/* Service Name Dropdown */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Service Name</label>
                {!showCustomService ? (
                  <select
                    value={service}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth"
                  >
                    {availableServices.map((svc) => (
                      <option key={svc.value} value={svc.value} className="bg-gray-900 text-white">{svc.label}</option>
                    ))}
                    <option value="__custom__" className="bg-gray-900 text-white">Custom...</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customService}
                      onChange={(e) => setCustomService(e.target.value)}
                      placeholder="e.g., checkout-service, payment-api"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth"
                      required
                    />
                    {availableServices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setShowCustomService(false); setService(availableServices[0].value); }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        ← Back to service list
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Latency Spike Investigation"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth"
                />
              </div>

              {/* Quick Time Range Buttons */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Quick Time Range</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TIME_RANGES.map((range) => (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => handleQuickTimeRange(range.minutes)}
                      className="px-3 py-1.5 text-xs font-medium border border-emerald-500/30 rounded-md hover:bg-emerald-500/10 text-emerald-300 transition-colors btn-press"
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Start Time</label>
                  <div
                    className="cursor-pointer"
                    onClick={() => startTimeRef.current?.showPicker()}
                  >
                    <input
                      ref={startTimeRef}
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">End Time</label>
                  <div
                    className="cursor-pointer"
                    onClick={() => endTimeRef.current?.showPicker()}
                  >
                    <input
                      ref={endTimeRef}
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Severity Multi-Select */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Severity Levels</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="all-severity"
                    checked={allSeverityLevels}
                    onChange={(e) => setAllSeverityLevels(e.target.checked)}
                    className="rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="all-severity" className="text-xs text-white/60">All Severity Levels</label>
                </div>
                {!allSeverityLevels && (
                  <div className="flex flex-wrap gap-2">
                    {SEVERITY_OPTIONS.map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => toggleSeverity(sev)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors btn-press ${
                          selectedSeverities.includes(sev)
                            ? sev === 'critical'
                              ? 'bg-red-500/20 border-red-400/50 text-red-300'
                              : sev === 'high'
                                ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                                : sev === 'medium'
                                  ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                                  : 'bg-green-500/20 border-green-400/50 text-green-300'
                            : 'bg-white/5 border-white/20 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sourcetype Filter */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Sourcetype Filter</label>
                <select
                  value={sourcetypeFilter}
                  onChange={(e) => setSourcetypeFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth"
                >
                  {SOURCETYPE_OPTIONS.map((st) => (
                    <option key={st} value={st} className="bg-gray-900 text-white">{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you investigating?"
                  rows={2}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-smooth"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium rounded-lg transition-all duration-200 shadow-sm btn-press"
              >
                Start Live Investigation
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
