'use client';

import { useState, useRef, useEffect } from 'react';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface ChatMessage {
  id: number;
  type: 'user' | 'system';
  content: string;
  spl?: string;
  results?: Record<string, string>[];
  count?: number;
  interpretation?: string;
  error?: string;
  timestamp: Date;
}

export default function NLQueryChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    playClickSound();
    const userQuery = input.trim();
    setInput('');
    setLoading(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: nextId.current++,
      type: 'user',
      content: userQuery,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/splunk/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery }),
      });
      const data = await res.json();

      if (data.success) {
        playSuccessSound();
        const systemMsg: ChatMessage = {
          id: nextId.current++,
          type: 'system',
          content: data.interpretation || 'Query executed',
          spl: data.spl,
          results: data.results || [],
          count: data.count || 0,
          interpretation: data.interpretation,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      } else {
        playErrorSound();
        const errorMsg: ChatMessage = {
          id: nextId.current++,
          type: 'system',
          content: 'Query failed',
          spl: data.spl || undefined,
          interpretation: data.interpretation || undefined,
          error: data.error || 'Unknown error',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      playErrorSound();
      const errorMsg: ChatMessage = {
        id: nextId.current++,
        type: 'system',
        content: 'Connection error',
        error: err instanceof Error ? err.message : 'Network error',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const suggestions = [
    'Show me errors',
    'How many events in the last hour?',
    'Which services are affected?',
    'Show deployments',
    'What is the latency?',
    'Top errors',
  ];

  return (
    <div className="flex flex-col h-[650px] animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Chat with Your Data</h2>
          <p className="text-xs text-white/50">
            Ask questions in plain English — SignalSage converts them to Splunk queries.
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scroll-smooth"
      >
        {/* Empty state with suggestions */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-6">
              <p className="text-sm text-white/60 mb-1">Ask anything about your data</p>
              <p className="text-xs text-white/30">
                SignalSage translates your questions into SPL and runs them against Splunk
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                    playClickSound();
                  }}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg border border-white/10 transition-all btn-press"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message history */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
          >
            {msg.type === 'user' ? (
              /* User message — right-aligned indigo bubble */
              <div className="max-w-[75%] bg-indigo-600/30 border border-indigo-500/30 rounded-xl rounded-br-sm px-4 py-2.5">
                <p className="text-sm text-white">{msg.content}</p>
                <p className="text-[10px] text-indigo-300/50 mt-1 text-right">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            ) : (
              /* System message — left-aligned gray bubble */
              <div className="max-w-[90%] space-y-1">
                <div className="bg-white/5 border border-white/10 rounded-xl rounded-bl-sm px-4 py-3">
                  {/* Interpretation */}
                  {msg.interpretation && (
                    <p className="text-xs text-white/70 mb-2 flex items-center gap-1.5">
                      <span className="text-indigo-400">•</span> {msg.interpretation}
                    </p>
                  )}

                  {/* SPL code block */}
                  {msg.spl && (
                    <div className="mb-3">
                      <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide mb-1">
                        Generated SPL
                      </p>
                      <code className="text-xs text-emerald-300 font-mono block bg-black/40 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                        {msg.spl}
                      </code>
                    </div>
                  )}

                  {/* Error */}
                  {msg.error && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> {msg.error}
                    </div>
                  )}

                  {/* Results table */}
                  {msg.results && msg.results.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40 mb-1.5">
                        {msg.count} result{msg.count !== 1 ? 's' : ''}
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              {Object.keys(msg.results[0])
                                .filter((k) => !k.startsWith('_') || k === '_time')
                                .slice(0, 6)
                                .map((key) => (
                                  <th
                                    key={key}
                                    className="text-left py-1.5 px-2.5 text-white/50 font-medium"
                                  >
                                    {key}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.results.slice(0, 10).map((row, i) => (
                              <tr
                                key={i}
                                className="border-b border-white/5 hover:bg-white/5 transition-colors"
                              >
                                {Object.keys(msg.results![0])
                                  .filter((k) => !k.startsWith('_') || k === '_time')
                                  .slice(0, 6)
                                  .map((key) => (
                                    <td
                                      key={key}
                                      className="py-1.5 px-2.5 text-white/70 truncate max-w-[180px]"
                                    >
                                      {String(row[key] ?? '—')}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {msg.results.length > 10 && (
                          <div className="px-2.5 py-1.5 bg-white/5 text-[10px] text-white/30">
                            ...and {msg.results.length - 10} more rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No results */}
                  {msg.results && msg.results.length === 0 && !msg.error && (
                    <p className="text-xs text-white/40">No results returned for this query.</p>
                  )}
                </div>
                <p className="text-[10px] text-white/20 px-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="bg-white/5 border border-white/10 rounded-xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></span>
                <span className="text-xs text-white/50">Translating & querying Splunk...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data..."
          disabled={loading}
          className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white text-sm font-medium rounded-xl transition-colors btn-press disabled:opacity-50"
        >
          {loading ? '...' : '→'}
        </button>
      </form>
    </div>
  );
}
