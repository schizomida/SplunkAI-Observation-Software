'use client';

import type { IncidentReport } from '@/types/index';

interface ReportPreviewProps {
  report: IncidentReport;
}

export default function ReportPreview({ report }: ReportPreviewProps) {
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Incident Report
        </h3>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          Download Report
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
        <div className="prose prose-sm max-w-none">
          {report.sections.map((section, i) => (
            <div key={i} className="mb-6">
              <h4 className="text-base font-semibold text-gray-800 mb-2">
                {section.title}
              </h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2 text-center">
        Generated at {new Date(report.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
