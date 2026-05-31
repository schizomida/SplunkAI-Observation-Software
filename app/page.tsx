'use client';

import { useState, useCallback } from 'react';
import type {
  Incident,
  InvestigationResult,
  IncidentReport,
  ApiResponse,
} from '@/lib/types';
import WelcomePage from '@/components/WelcomePage';
import IncidentSelector from '@/components/IncidentSelector';
import QueryPanel from '@/components/QueryPanel';
import EvidenceTimeline from '@/components/EvidenceTimeline';
import RootCauseCard from '@/components/RootCauseCard';
import RemediationChecklist from '@/components/RemediationChecklist';
import ReportPreview from '@/components/ReportPreview';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import SplunkHealthBadge from '@/components/SplunkHealthBadge';
import {
  playClickSound,
  playSuccessSound,
  playTransitionSound,
  playErrorSound,
  playStartSound,
} from '@/lib/sounds';

type AppView = 'welcome' | 'main';
type Tab = 'select' | 'investigation' | 'rootcause' | 'remediation' | 'report';

const TABS: { id: Tab; label: string; icon: string; step: number }[] = [
  { id: 'select', label: 'Select Incident', icon: '🎯', step: 1 },
  { id: 'investigation', label: 'Investigation', icon: '🔍', step: 2 },
  { id: 'rootcause', label: 'Root Cause', icon: '🧠', step: 3 },
  { id: 'remediation', label: 'Remediation', icon: '🛠️', step: 4 },
  { id: 'report', label: 'Report', icon: '📋', step: 5 },
];

interface AiSummaries {
  investigation: string | null;
  rootcause: string | null;
  remediation: string | null;
  executive: string | null;
}

export default function Home() {
  const [view, setView] = useState<AppView>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('select');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] =
    useState<InvestigationResult | null>(null);
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<AiSummaries>({
    investigation: null,
    rootcause: null,
    remediation: null,
    executive: null,
  });

  function handleStartFromWelcome() {
    setView('main');
  }

  function handleTabChange(tab: Tab) {
    playTransitionSound();
    setActiveTab(tab);
  }

  // Fetch AI summaries after investigation completes
  const fetchAiSummaries = useCallback(async (inc: Incident, result: InvestigationResult) => {
    const fetchSummary = async (type: string, context: Record<string, unknown>): Promise<string | null> => {
      try {
        const res = await fetch('/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, context }),
        });
        const data = await res.json();
        return data.summary || null;
      } catch {
        return null;
      }
    };

    const [investigationSummary, rootcauseSummary, remediationSummary, executiveSummary] =
      await Promise.allSettled([
        fetchSummary('investigation', {
          incident: inc,
          evidence: result.evidence,
          hypotheses: result.hypotheses,
        }),
        fetchSummary('rootcause', {
          hypotheses: result.hypotheses,
          evidence: result.evidence,
        }),
        fetchSummary('remediation', {
          steps: result.remediation,
          hypotheses: result.hypotheses,
        }),
        fetchSummary('executive', {
          incident: inc,
          result,
        }),
      ]);

    setAiSummaries({
      investigation: investigationSummary.status === 'fulfilled' ? investigationSummary.value : null,
      rootcause: rootcauseSummary.status === 'fulfilled' ? rootcauseSummary.value : null,
      remediation: remediationSummary.status === 'fulfilled' ? remediationSummary.value : null,
      executive: executiveSummary.status === 'fulfilled' ? executiveSummary.value : null,
    });
  }, []);

  async function handleSelectIncident(selected: Incident) {
    playStartSound();
    setIncident(selected);
    setLoading(true);
    setError(null);
    setAiSummaries({ investigation: null, rootcause: null, remediation: null, executive: null });

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
      playSuccessSound();

      // Fetch AI summaries in background (non-blocking)
      fetchAiSummaries(selected, investigateData.data);
    } catch (err) {
      playErrorSound();
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    playClickSound();
    setError(null);
    if (incident) {
      handleSelectIncident(incident);
    }
  }

  function severityBadgeColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function renderAiSummary(summary: string | null) {
    if (!summary) return null;
    return (
      <div className="ai-summary-card mb-6 animate-fade-in-up">
        <div className="flex items-start gap-2">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">AI Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          </div>
        </div>
      </div>
    );
  }

  function renderTabContent() {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 border border-red-200 rounded-xl bg-gradient-to-br from-red-50 to-white animate-scale-in">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-red-700 font-semibold mb-2 text-lg">Investigation Failed</p>
          <p className="text-sm text-red-500 mb-1 text-center max-w-md">{error}</p>
          <p className="text-xs text-gray-400 mb-4">
            This could be a network issue or the backend service may be unavailable.
          </p>
          <button
            onClick={handleRetry}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm btn-press"
          >
            🔄 Retry Investigation
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
            <p className="text-gray-500 text-center py-8">
              Select an incident first.
            </p>
          );
        }
        return (
          <div className="space-y-8 animate-fade-in-up">
            {renderAiSummary(aiSummaries.investigation)}
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm">🔍</span>
                Investigation Queries
              </h2>
              <QueryPanel queries={investigation.queries} />
            </section>
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-sm">📎</span>
                Evidence Timeline
              </h2>
              <EvidenceTimeline evidence={investigation.evidence} />
            </section>
          </div>
        );

      case 'rootcause':
        if (!investigation) {
          return (
            <p className="text-gray-500 text-center py-8">
              Run an investigation first.
            </p>
          );
        }
        return (
          <div className="animate-fade-in-up">
            {renderAiSummary(aiSummaries.rootcause)}
            <RootCauseCard hypotheses={investigation.hypotheses} />
          </div>
        );

      case 'remediation':
        if (!investigation) {
          return (
            <p className="text-gray-500 text-center py-8">
              Run an investigation first.
            </p>
          );
        }
        return (
          <div className="animate-fade-in-up">
            {renderAiSummary(aiSummaries.remediation)}
            <RemediationChecklist steps={investigation.remediation} />
          </div>
        );

      case 'report':
        if (!report) {
          return (
            <p className="text-gray-500 text-center py-8">
              Generate a report first.
            </p>
          );
        }
        return (
          <div className="animate-fade-in-up">
            {renderAiSummary(aiSummaries.executive)}
            <ReportPreview report={report} />
          </div>
        );

      default:
        return null;
    }
  }

  // Show welcome page
  if (view === 'welcome') {
    return <WelcomePage onStart={handleStartFromWelcome} />;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="gradient-header px-6 py-5 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔮</span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                SignalSage
              </h1>
              <p className="text-indigo-200 text-xs">AI-Powered Incident Investigation</p>
            </div>
          </div>
          {incident && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${severityBadgeColor(incident.severity)}`}>
                {incident.severity.toUpperCase()}
              </span>
              <span className="text-sm text-white/90 font-medium">
                {incident.title}
              </span>
            </div>
          )}
          <SplunkHealthBadge />
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto py-1">
            {TABS.map((tab, index) => {
              const isActive = activeTab === tab.id;
              const isCompleted = incident && (
                (tab.id === 'select') ||
                (tab.id === 'investigation' && investigation) ||
                (tab.id === 'rootcause' && investigation) ||
                (tab.id === 'remediation' && investigation) ||
                (tab.id === 'report' && report)
              );

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap rounded-t-lg btn-press ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 tab-active-indicator" />
                  )}
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white glow-indigo'
                      : isCompleted
                        ? 'bg-green-500 text-white glow-green'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted && !isActive ? '✓' : tab.step}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.icon}</span>
                  {index < TABS.length - 1 && (
                    <span className="text-gray-300 ml-1 hidden lg:inline">→</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Status banner */}
      {incident && !loading && !error && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Investigation complete
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>Service: <span className="font-medium text-gray-700">{incident.service}</span></span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>Mode: <span className="font-medium text-gray-700">{incident.mode}</span></span>
              {investigation && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>{investigation.evidence.length} evidence items</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>{investigation.hypotheses.length} hypotheses</span>
                </>
              )}
            </div>
            <button
              onClick={() => {
                playClickSound();
                setIncident(null);
                setInvestigation(null);
                setReport(null);
                setActiveTab('select');
                setAiSummaries({ investigation: null, rootcause: null, remediation: null, executive: null });
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors btn-press"
            >
              ← New Investigation
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <ErrorBoundary onRetry={handleRetry}>
          {renderTabContent()}
        </ErrorBoundary>
      </div>
    </main>
  );
}
