'use client';

import { useState, useRef, useEffect } from 'react';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface QueryHistoryItem {
  id: number;
  naturalLanguage: string;
  spl: string;
  results: Record<string, string>[];
  timestamp: Date;
  error?: string;
}

/**
 * Converts a natural language query to SPL using rule-based matching.
 */
function convertNLToSPL(query: string): string {
  const lower = query.toLowerCase().trim();

  if (lower.includes('show errors') || lower === 'errors') {
    return 'index=main sourcetype=app_logs level=ERROR | head 20';
  }
  if (lower.includes('count errors by service') || lower.includes('errors per service')) {
    return 'index=main sourcetype=app_logs level=ERROR | stats count by service';
  }
  if (lower.includes('slowest services') || lower.includes('slow services') || lower.includes('latency by service')) {
    return 'index=main sourcetype=app_traces | stats avg(durationMs) as latency by service | sort -latency';
  }
  if (lower.includes('recent deployments') || lower.includes('deployments')) {
    return 'index=main sourcetype=deployment | sort -_time | head 10';
  }
  if (lower.includes('top error messages') || lower.includes('top errors') || lower.includes('common errors')) {
    return 'index=main sourcetype=app_logs level=ERROR | top message';
  }
  if (lower.includes('error rate') || lower.includes('error trend')) {
    return 'index=main sourcetype=app_logs level=ERROR | timechart span=1m count';
  }
  if (lower.includes('services') || lower.includes('list services')) {
    return 'index=main | stats count by service | sort -count';
  }
  if (lower.includes('warnings') || lower.includes('show warnings')) {
    return 'index=main sourcetype=app_logs level=WARN | head 20';
  }

  // Default: keyword search
  const userText = query.replace(/['"]/g, '').trim();
  return `index=main "${userText}" earliest=-1h | head 20`;
}

export default function NaturalLanguageQuery() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let nextId = useRef(1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    playClickSound();
    setLoading(true);

    const naturalLanguage = input.trim();
    const spl = convertNLToSPL(naturalLanguage);
    setInput('');

    try {
      const res = await fetch('/api/splunk/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spl }),
      });
      const data = await res.json();

      if (data.success) {
        playSuccessSound();
        setHistory(prev => [
          ...prev.slice(-9),
          {
            id: nextId.current++,
            naturalLanguage,
            spl,
            results: data.results || [],
            timestamp: new Date(),
          },
        ]);
      } else {
        playErrorSound();
        setHistory(prev => [
          ...prev.slice(-9),
          {
            id: nextId.current++,
            naturalLanguage,
            spl,
            results: [],
            timestamp: new Date(),
            error: data.error || 'Query failed',
          },
        ]);
      }
    } catch (err) {
      playErrorSound();
      setHistory(prev => [
        ...prev.slice(-9),
        {
          id: nextId.current++,
          naturalLanguage,
          spl,
          results: [],
          timestamp: new Date(),
          error: err instanceof Error ? err.message : 'Network error',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const suggestions = [
    'Show errors',
    'Count errors by service',
    'Slowest services',
    'Recent deployments',
    'Top error messages',
  ];

  return (
    <div className="flex flex-col h-[600px] animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">💬</span>
        <div>
          <h2 className="text-lg font-bold text-white">Ask Your Data</h2>
          <p className="text-xs text-white/50">Natural language → Splunk queries. No SPL knowledge required.</p>
        </div>
      </div>

      {/* Suggestions */}
      {history.length === 0 && (
        <div className="mb-4">
          <p className="text-xs text-white/40 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus(); playClickSound(); }}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg border border-white/10 transition-all btn-press"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Query History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {history.map((item) => (
          <div key={item.id} className="space-y-2 animate-fade-in-up">
            {/* User query */}
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-indigo-600/30 border border-indigo-500/30 rounded-xl rounded-br-sm px-4 py-2">
                <p className="text-sm text-white">{item.naturalLanguage}</p>
              </div>
            </div>

            {/* Generated SPL */}
            <div className="flex justify-start">
              <div className="max-w-[90%] space-y-2">
                <div className="bg-white/5 border border-white/10 rounded-xl rounded-bl-sm px-4 py-3">
                  <p className="text-xs text-indigo-400 font-semibold mb-1">Generated SPL:</p>
                  <code className="text-xs text-emerald-300 font-mono block bg-black/30 rounded-lg px-3 py-2 overflow-x-auto">
                    {item.spl}
                  </code>

                  {item.error ? (
                    <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                      <span>⚠️</span> {item.error}
                    </div>
                  ) : item.results.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs text-white/50 mb-1">{item.results.length} result{item.results.length !== 1 ? 's' : ''}:</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/10">
                              {Object.keys(item.results[0]).filter(k => !k.startsWith('_')).slice(0, 5).map((key) => (
                                <th key={key} className="text-left py-1 px-2 text-white/50 font-medium">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {item.results.slice(0, 10).map((row, i) => (
                              <tr key={i} className="border-b border-white/5">
                                {Object.keys(item.results[0]).filter(k => !k.startsWith('_')).slice(0, 5).map((key) => (
                                  <td key={key} className="py-1 px-2 text-white/70 truncate max-w-[200px]">
                                    {String(row[key] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {item.results.length > 10 && (
                          <p className="text-xs text-white/30 mt-1">...and {item.results.length - 10} more</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-white/40">No results returned.</p>
                  )}
                </div>
                <p className="text-[10px] text-white/30 px-1">
                  {item.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="animate-spin text-sm">⟳</span>
                <span className="text-xs text-white/50">Querying Splunk...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your data anything..."
          disabled={loading}
          className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white text-sm font-medium rounded-xl transition-colors btn-press disabled:opacity-50"
        >
          {loading ? '⟳' : '→'}
        </button>
      </form>
    </div>
  );
}
