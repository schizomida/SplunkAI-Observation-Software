'use client';

import { useState } from 'react';
import type { IncidentReport } from '@/lib/types';

interface ReportPreviewProps {
  report: IncidentReport;
}

export default function ReportPreview({ report }: ReportPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<number>>(
    new Set(report.sections.map((_, i) => i))
  );

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

  function toggleSection(index: number) {
    setVisibleSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">📋 Incident Report</h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
              copied
                ? 'bg-green-500/20 border-green-400/30 text-green-300'
                : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/20'
            }`}
          >
            {copied ? '✓ Copied' : '📋 Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-lg hover:shadow-indigo-500/30"
          >
            ⬇️ Download .md
          </button>
        </div>
      </div>

      {/* Report metadata */}
      <div className="flex items-center gap-4 mb-4 text-xs text-white/50 bg-white/5 rounded-lg px-4 py-2 border border-white/10">
        <span>📅 Generated: {new Date(report.generatedAt).toLocaleString()}</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>🆔 Incident: {report.incidentId}</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span>📑 {report.sections.length} sections</span>
      </div>

      {/* Section toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {report.sections.map((section, i) => (
          <button
            key={i}
            onClick={() => toggleSection(i)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors hover:bg-white/10 ${
              visibleSections.has(i)
                ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300'
                : 'bg-white/5 border-white/20 text-white/40 line-through'
            }`}
          >
            {section.title}
          </button>
        ))}
      </div>

      {/* Report content */}
      <div className="border border-white/10 rounded-xl p-6 bg-white/5 backdrop-blur shadow-sm">
        <div className="prose prose-sm max-w-none">
          {report.sections.map((section, i) => {
            if (!visibleSections.has(i)) return null;
            return (
              <div key={i} className="mb-8 last:mb-0 animate-fade-in-up opacity-0" style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'forwards' }}>
                <h4 className="text-base font-bold text-white/90 mb-3 pb-2 border-b border-white/10 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold">
                    {i + 1}
                  </span>
                  {section.title}
                </h4>
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono bg-gray-900/50 rounded-lg p-4 border border-white/10">
                  {section.content}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-white/40 mt-3 text-center">
        Report generated at {new Date(report.generatedAt).toLocaleString()} • Incident ID: {report.incidentId}
      </p>
    </div>
  );
}
