'use client';

import { useState, useRef, useEffect } from 'react';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface ChatMessage {
  id: number;
  role: 'user' | 'system';
  content: string;
  spl?: string;
  results?: Record<string, string>[];
  count?: number;
  explanation?: string;
  error?: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  'Show me recent errors',
  'What services are affected?',
  'Find timeout events',
  'Show deployment history',
];

export default function NLQueryChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend(text?: string) {
    const message = (text || input).trim();
    if (!message || loading) return;

    playClickSound();
    setInput('');
    setLoading(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: nextId.current++,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();

      if (data.error) {
        playErrorSound();
        setMessages(prev => [...prev, {
          id: nextId.current++,
          role: 'system',
          content: 'Query failed',
          error: data.error,
          timestamp: new Date(),
        }]);
      } else {
        playSuccessSound();
        setMessages(prev => [...prev, {
          id: nextId.current++,
          role: 'system',
          content: data.explanation || 'Query executed successfully.',
          spl: data.spl,
          results: data.results || [],
          count: data.count ?? 0,
          explanation: data.explanation,
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      playErrorSound();
      setMessages(prev => [...prev, {
        id: nextId.current++,
        role: 'system',
        content: 'Network error',
        error: err instanceof Error ? err.message : 'Failed to reach server',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend();
  }

  function renderResults(msg: ChatMessage) {
    if (!msg.results || msg.results.length === 0) {
      return <p className="text-xs text-white/40 mt-2">No results returned.</p>;
    }

    const keys = Object.keys(msg.results[0]).filter(k => !k.startsWith('_')).slice(0, 6);
    const displayResults = msg.results.slice(0, 8);

    return (
      <div className="mt-3 overflow-x-auto">
        <p className="text-[10px] text-white/40 mb-1">{msg.count} result{msg.count !== 1 ? 's' : ''}</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {keys.map(key => (
                <th key={key} className="text-left py-1.5 px-2 text-white/50 font-medium text-[11px]">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayResults.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                {keys.map(key => (
                  <td key={key} className="py-1.5 px-2 text-white/70 text-[11px] truncate max-w-[180px]">
                    {String(row[key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {msg.results.length > 8 && (
          <p className="text-[10px] text-white/30 mt-1 px-2">...and {msg.results.length - 8} more results</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[650px] animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">💬</span>
        <div>
          <h2 className="text-lg font-bold text-white">Ask Your Data</h2>
          <p className="text-xs text-white/50">Ask questions in plain English — get Splunk results instantly.</p>
        </div>
      </div>

      {/* Suggested Prompts */}
      {messages.length === 0 && (
        <div className="mb-4">
          <p className="text-xs text-white/40 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-indigo-600/30 text-white/70 hover:text-white rounded-lg border border-white/10 hover:border-indigo-500/30 transition-all btn-press"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[75%] bg-purple-600/30 border border-purple-500/30 rounded-xl rounded-br-sm px-4 py-2.5">
                <p className="text-sm text-white">{msg.content}</p>
                <p className="text-[10px] text-white/30 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
              </div>
            ) : (
              <div className="max-w-[90%] bg-white/5 border border-white/10 rounded-xl rounded-bl-sm px-4 py-3 space-y-2">
                {msg.error ? (
                  <div className="text-xs text-red-400 flex items-center gap-1.5">
                    <span>⚠️</span> {msg.error}
                  </div>
                ) : (
                  <>
                    {msg.explanation && (
                      <p className="text-xs text-white/70">{msg.explanation}</p>
                    )}
                    {msg.spl && (
                      <div className="mt-1">
                        <p className="text-[10px] text-indigo-400 font-semibold mb-1">Generated SPL:</p>
                        <code className="text-[11px] text-emerald-300 font-mono block bg-black/40 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {msg.spl}
                        </code>
                      </div>
                    )}
                    {renderResults(msg)}
                  </>
                )}
                <p className="text-[10px] text-white/20 pt-1">{msg.timestamp.toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 loading-dot-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 loading-dot-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 loading-dot-3" />
                </div>
                <span className="text-xs text-white/50">thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/10 pt-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question about your data..."
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
