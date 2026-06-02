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
import WizardMascot from '@/components/WizardMascot';
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

// Map evidence type → hypothesis type for highlighting
const EVIDENCE_TO_HYPOTHESIS: Record<string, string> = {
  log: 'error-spike',
  metric: 'resource-exhaustion',
  trace: 'performance-degradation',
  deployment: 'deployment-correlation',
};

interface AiSummaries {
  investigation: string | null;
  rootcause: string | null;
  remediation: string | null;
  executive: string | null;
}

type WizardReaction = 'idle' | 'excited' | 'thinking' | 'celebrating' | 'alert';

export default function Home() {
  const [view, setView] = useState<AppView>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('select');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<AiSummaries>({
    investigation: null,
    rootcause: null,
    remediation: null,
    executive: null,
  });
  const [highlightedHypothesis, setHighlightedHypothesis] = useState<string | null>(null);
  const [highlightedStep, setHighlightedStep] = useState<string | null>(null);
  const [wizardReaction, setWizardReaction] = useState<WizardReaction>('idle');

  function handleStartFromWelcome() {
    setView('main');
  }

  function handleTabChange(tab: Tab | string, evidenceType?: string) {
    playTransitionSound();
    setActiveTab(tab as Tab);

    // Handle highlight from evidence navigation
    if (evidenceType) {
      const hypothesisType = EVIDENCE_TO_HYPOTHESIS[evidenceType];
      if (hypothesisType) {
        if (tab === 'rootcause') {
          setHighlightedHypothesis(hypothesisType);
          setTimeout(() => setHighlightedHypothesis(null), 3000);
        } else if (tab === 'remediation') {
          // Highlight first step matching the hypothesis order
          if (investigation) {
            const hypothesisIndex = investigation.hypotheses.findIndex(
              (h) => h.type === hypothesisType
            );
            if (hypothesisIndex >= 0 && investigation.remediation[hypothesisIndex]) {
              setHighlightedStep(investigation.remediation[hypothesisIndex].id);
              setTimeout(() => setHighlightedStep(null), 3000);
            }
          }
        }
      }
    }
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
        fetchSummary('investigation', { incident: inc, evidence: result.evidence, hypotheses: result.hypotheses }),
        fetchSummary('rootcause', { hypotheses: result.hypotheses, evidence: result.evidence }),
        fetchSummary('remediation', { steps: result.remediation, hypotheses: result.hypotheses }),
        fetchSummary('executive', { incident: inc, result }),
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
    setWizardReaction('thinking');
    setAiSummaries({ investigation: null, rootcause: null, remediation: null, executive: null });

    try {
      const createRes = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const createData: ApiResponse<Incident> = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to register incident');
      }

      const investigateRes = await fetch(`/api/incidents/${selected.id}/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const investigateData: ApiResponse<InvestigationResult> = await investigateRes.json();
      if (!investigateData.success || !investigateData.data) {
        throw new Error(investigateData.error || 'Failed to run investigation');
      }
      setInvestigation(investigateData.data);

      const reportRes = await fetch(`/api/incidents/${selected.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      });
      const reportData: ApiResponse<IncidentReport> = await reportRes.json();
      if (!reportData.success || !reportData.data) {
        throw new Error(reportData.error || 'Failed to generate report');
      }
      setReport(reportData.data);

      setActiveTab('investigation');
      playSuccessSound();
      setWizardReaction('excited');
      setTimeout(() => setWizardReaction('idle'), 3000);

      fetchAiSummaries(selected, investigateData.data);
    } catch (err) {
      playErrorSound();
      setWizardReaction('alert');
      setTimeout(() => setWizardReaction('idle'), 3000);
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
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'low': return 'bg-green-500/20 text-green-300 border-green-400/30';
      default: return 'bg-white/10 text-white/70 border-white/20';
    }
  }

  function renderAiSummary(summary: string | null) {
    if (!summary) return null;
    return (
      <div className="ai-summary-card mb-6 animate-fade-in-up">
        <div className="flex items-start gap-2">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">AI Summary</p>
            <p className="text-sm text-white/80 leading-relaxed">{summary}</p>
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
        <div className="flex flex-col items-center justify-center p-8 border border-red-500/30 rounded-xl bg-red-500/10 backdrop-blur animate-scale-in">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-red-300 font-semibold mb-2 text-lg">Investigation Failed</p>
          <p className="text-sm text-red-400/80 mb-1 text-center max-w-md">{error}</p>
          <p className="text-xs text-white/40 mb-4">
            This could be a network issue or the backend service may be unavailable.
          </p>
          <button
            onClick={handleRetry}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm btn-press"
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
          return <p className="text-white/50 text-center py-8">Select an incident first.</p>;
        }
        return (
          <div className="space-y-8 animate-fade-in-up">
            {renderAiSummary(aiSummaries.investigation)}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 text-sm">📎</span>
                Evidence Timeline ({investigation.evidence.length} items)
              </h2>
              <EvidenceTimeline
                evidence={investigation.evidence}
                queries={investigation.queries}
                onNavigate={handleTabChange}
              />
            </section>
          </div>
        );

      case 'rootcause':
        if (!investigation) {
          return <p className="text-white/50 text-center py-8">Run an investigation first.</p>;
        }
        return (
          <div className="animate-fade-in-up">
            {renderAiSummary(aiSummaries.rootcause)}
            <RootCauseCard hypotheses={investigation.hypotheses} highlightedType={highlightedHypothesis} onNavigate={handleTabChange} />
          </div>
        );

      case 'remediation':
        if (!investigation) {
          return <p className="text-white/50 text-center py-8">Run an investigation first.</p>;
        }
        return (
          <div className="animate-fade-in-up">
            {renderAiSummary(aiSummaries.remediation)}
            <RemediationChecklist steps={investigation.remediation} highlightedStepId={highlightedStep} />
          </div>
        );

      case 'report':
        if (!report) {
          return <p className="text-white/50 text-center py-8">Generate a report first.</p>;
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

  if (view === 'welcome') {
    return <WelcomePage onStart={handleStartFromWelcome} />;
  }

  return (
    <main className={`min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 animate-scale-in-app${investigation ? ' bg-breathing' : ''}`}>
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WizardMascot reaction={wizardReaction} size="sm" />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">SignalSage</h1>
              <p className="text-indigo-300/60 text-xs">AI-Powered Incident Investigation</p>
            </div>
          </div>
          {incident && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${severityBadgeColor(incident.severity)} hover:scale-[1.02] transition-transform`}>
                {incident.severity.toUpperCase()}
              </span>
              <span className="text-sm text-white/90 font-medium">{incident.title}</span>
            </div>
          )}
          <SplunkHealthBadge />
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
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
                      ? 'border-indigo-400 text-white bg-white/10'
                      : 'border-transparent text-white/50 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 tab-active-indicator" />
                  )}
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-500 text-white glow-indigo'
                      : isCompleted
                        ? 'bg-green-500 text-white glow-green'
                        : 'bg-white/10 text-white/50'
                  }`}>
                    {isCompleted && !isActive ? '✓' : tab.step}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.icon}</span>
                  {index < TABS.length - 1 && (
                    <span className="text-white/20 ml-1 hidden lg:inline">→</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Status banner */}
      {incident && !loading && !error && (
        <div className="bg-white/5 border-b border-white/10 transition-all duration-300">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Investigation complete
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Service: <span className="font-medium text-white/90">{incident.service === '*' ? 'All' : incident.service}</span></span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Mode: <span className="font-medium text-white/90">{incident.mode}</span></span>
              {investigation && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>{investigation.evidence.length} evidence items</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
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
              className="text-xs text-indigo-300 hover:text-indigo-200 font-medium transition-colors btn-press"
            >
              ← New Investigation
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <ErrorBoundary onRetry={handleRetry}>
          <div key={activeTab} className="tab-content-enter">
            {renderTabContent()}
          </div>
        </ErrorBoundary>
      </div>
    </main>
  );
}
