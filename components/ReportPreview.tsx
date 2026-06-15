'use client';

import { useState } from 'react';
import type { IncidentReport } from '@/lib/types';

interface ReportPreviewProps {
  report: IncidentReport;
}

const SECTION_ICONS: Record<string, string> = {
  'Executive Summary': 'TL;DR',
  'Timeline': 'TIME',
  'Evidence Table': 'DATA',
  'Root Cause Analysis': 'ROOT',
  'Remediation Checklist': 'FIX',
  'Follow-up Items': 'NEXT',
};

export default function ReportPreview({ report }: ReportPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<number | null>(0);
  const [shareVisible, setShareVisible] = useState(false);

  function handleDownload() {
    const blob = new Blob([report.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${report.incidentId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    navigator.clipboard.writeText(report.markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShare() {
    setShareVisible(true);
    setTimeout(() => setShareVisible(false), 3000);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">Post-Incident Report</h3>
          <p className="text-xs text-white/50 mt-1">
            Auto-generated from your investigation — ready to share with your team
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300"
          >
            {shareVisible ? 'Link copied!' : 'Share'}
          </button>
          <button
            onClick={handleCopy}
            className={`px-3 py-2 text-xs font-medium rounded-lg border ${
              copied ? 'bg-green-500/20 border-green-400/30 text-green-300' : 'bg-emerald-900/20 border-emerald-800/30 text-white/70'
            }`}
          >
            {copied ? 'Copied!' : 'Copy All'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg"
          >
            Export .md
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-white">{report.sections.length}</p>
          <p className="text-[10px] text-white/50">Sections</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-white">{report.markdown.split('\n').length}</p>
          <p className="text-[10px] text-white/50">Lines</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-emerald-300">Ready</p>
          <p className="text-[10px] text-white/50">Status</p>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="space-y-2">
        {report.sections.map((section, i) => {
          const isExpanded = expandedSection === i;
          const icon = SECTION_ICONS[section.title] || `S${i + 1}`;
          return (
            <div key={i} className="border border-white/10 rounded-lg bg-slate-900/50 overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {icon}
                </span>
                <span className="text-sm font-semibold text-white/90 flex-1">{section.title}</span>
                <span className="text-xs text-white/30">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4">
                  <pre className="text-xs text-white/60 whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto bg-black/20 rounded-lg p-3">
                    {section.content.length > 2000
                      ? section.content.slice(0, 2000) + '\n\n... (download full report for complete content)'
                      : section.content}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-white/30 mt-4 text-center">
        Generated {new Date(report.generatedAt).toLocaleString()} — paste into Confluence, Notion, or Jira
      </p>
    </div>
  );
}
