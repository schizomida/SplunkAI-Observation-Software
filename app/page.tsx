'use client';

import { useState } from 'react';
import type {
  Incident,
  InvestigationResult,
  IncidentReport,
  ApiResponse,
} from '@/types/index';
import IncidentSelector from '@/components/IncidentSelector';
import QueryPanel from '@/components/QueryPanel';
import EvidenceTimeline from '@/components/EvidenceTimeline';
import RootCauseCard from '@/components/RootCauseCard';
import RemediationChecklist from '@/components/RemediationChecklist';
import ReportPreview from '@/components/ReportPreview';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

type Tab = 'select' | 'investigation' | 'rootcause' | 'remediation' | 'report';

const TABS: { id: Tab; label: string }[] = [
  { id: 'select', label: 'Select Incident' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'rootcause', label: 'Root Cause' },
  { id: 'remediation', label: 'Remediation' },
  { id: 'report', label: 'Report' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('select');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] =
    useState<InvestigationResult | null>(null);
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectIncident(selected: Incident) {
    setIncident(selected);
    setLoading(true);
    setError(null);

    try {
      // Register the incident
      const createRes = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const createData: ApiResponse<Incident> = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to register incident');
      }

      // Run investigation
      const investigateRes = await fetch(
        `/api/incidents/${selected.id}/investigate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selected),
        }
      );
      const investigateData: ApiResponse<InvestigationResult> =
        await investigateRes.json();
      if (!investigateData.success || !investigateData.data) {
        throw new Error(
          investigateData.error || 'Failed to run investigation'
        );
      }
      setInvestigation(investigateData.data);

      // Generate report
      const reportRes = await fetch(`/api/incidents/${selected.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const reportData: ApiResponse<IncidentReport> =
        await reportRes.json();
      if (!reportData.success || !reportData.data) {
        throw new Error(reportData.error || 'Failed to generate report');
      }
      setReport(reportData.data);

      setActiveTab('investigation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    setError(null);
    if (incident) {
      handleSelectIncident(incident);
    }
  }

  function renderTabContent() {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-700 font-medium mb-2">Error</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'select':
        return <IncidentSelector onSelect={handleSelectIncident} />;

      case 'investigation':
        if (!investigation) {
          return (
            <p className="text-gray-500 text-center">
              Select an incident first.
            </p>
          );
        }
        return (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Investigation Queries
              </h2>
              <QueryPanel queries={investigation.queries} />
            </section>
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Evidence Timeline
              </h2>
              <EvidenceTimeline evidence={investigation.evidence} />
            </section>
          </div>
        );

      case 'rootcause':
        if (!investigation) {
          return (
            <p className="text-gray-500 text-center">
              Run an investigation first.
            </p>
          );
        }
        return <RootCauseCard hypotheses={investigation.hypotheses} />;

      case 'remediation':
        if (!investigation) {
          return (
            <p className="text-gray-500 text-center">
              Run an investigation first.
            </p>
          );
        }
        return (
          <RemediationChecklist steps={investigation.remediation} />
        );

      case 'report':
        if (!report) {
          return (
            <p className="text-gray-500 text-center">
              Generate a report first.
            </p>
          );
        }
        return <ReportPreview report={report} />;

      default:
        return null;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            🔮 SignalSage
          </h1>
          {incident && (
            <span className="text-sm text-gray-500">
              Investigating: {incident.title}
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <ErrorBoundary onRetry={handleRetry}>
          {renderTabContent()}
        </ErrorBoundary>
      </div>
    </main>
  );
}
