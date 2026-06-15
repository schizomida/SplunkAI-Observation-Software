'use client';

import { useState, useRef, useEffect } from 'react';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  spl?: string;
  results?: Record<string, string>[];
  count?: number;
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

    const userMsg: ChatMessage = {
      id: nextId.current++,
      type: 'user',
      content: userQuery,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // First, try to get an AI-powered conversational response
      const chatRes = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          history: messages.slice(-6).map((m) => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content })),
        }),
      });
      const chatData = await chatRes.json();

      if (chatData.success) {
        playSuccessSound();
        const assistantMsg: ChatMessage = {
          id: nextId.current++,
          type: 'assistant',
          content: chatData.answer || chatData.interpretation || 'Here are the results.',
          spl: chatData.spl || undefined,
          results: chatData.results || undefined,
          count: chatData.count || 0,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        // Fall back to NL query endpoint
        const nlRes = await fetch('/api/splunk/nl-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userQuery }),
        });
        const nlData = await nlRes.json();

        if (nlData.success) {
          playSuccessSound();
          // Get AI explanation
          let explanation = nlData.interpretation || 'Query complete.';
          try {
            const aiRes = await fetch('/api/ai/summarize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'investigation',
                context: { userQuestion: userQuery, spl: nlData.spl, resultCount: nlData.count, sampleResults: (nlData.results || []).slice(0, 3) },
              }),
            });
            const aiData = await aiRes.json();
            if (aiData.summary) explanation = aiData.summary;
          } catch { /* optional */ }

          const msg: ChatMessage = {
            id: nextId.current++,
            type: 'assistant',
            content: explanation,
            spl: nlData.spl,
            results: nlData.results || [],
            count: nlData.count || 0,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
        } else {
          throw new Error(nlData.error || chatData.error || 'Query failed');
        }
      }
    } catch (err) {
      playErrorSound();
      setMessages((prev) => [...prev, {
        id: nextId.current++,
        type: 'assistant',
        content: 'I encountered an issue processing that request.',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const suggestions = [
    'What errors happened recently?',
    'Which service has the worst health?',
    'Explain the latency spike',
    'What deployments happened today?',
    'Are there any anomalies?',
    'Summarize the current situation',
  ];

  return (
    <div className="flex flex-col h-[650px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
          <span className="text-emerald-300 text-sm font-bold">AI</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Ask Splunk Assistant</h2>
          <p className="text-xs text-white/50">
            Conversational AI powered by your live Splunk data
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mb-4">
              <span className="text-2xl text-emerald-300 font-bold">?</span>
            </div>
            <p className="text-sm text-white/60 mb-1">Ask anything about your observability data</p>
            <p className="text-xs text-white/30 mb-6">
              I can query Splunk, explain results, and help you understand what's happening
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); playClickSound(); }}
                  className="px-3 py-1.5 text-xs bg-emerald-900/20 border border-emerald-800/30 text-emerald-300/80 rounded-lg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.type === 'user' ? (
              <div className="max-w-[75%] bg-indigo-600/30 border border-indigo-500/30 rounded-xl rounded-br-sm px-4 py-2.5">
                <p className="text-sm text-white">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[90%] space-y-1">
                <div className="bg-emerald-900/10 border border-emerald-800/20 rounded-xl rounded-bl-sm px-4 py-3">
                  {/* AI response */}
                  <p className="text-sm text-white/80 leading-relaxed mb-2">{msg.content}</p>

                  {/* SPL used */}
                  {msg.spl && (
                    <details className="mb-2">
                      <summary className="text-[10px] text-emerald-400 cursor-pointer font-medium">View SPL query</summary>
                      <code className="text-[11px] text-emerald-300/70 font-mono block bg-black/30 rounded px-2 py-1.5 mt-1 overflow-x-auto whitespace-pre-wrap">
                        {msg.spl}
                      </code>
                    </details>
                  )}

                  {/* Error */}
                  {msg.error && (
                    <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{msg.error}</p>
                  )}

                  {/* Results */}
                  {msg.results && msg.results.length > 0 && (
                    <details>
                      <summary className="text-[10px] text-white/40 cursor-pointer">{msg.count} result{msg.count !== 1 ? 's' : ''} — click to view</summary>
                      <div className="overflow-x-auto rounded border border-white/10 mt-1">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              {Object.keys(msg.results[0]).filter((k) => !k.startsWith('_') || k === '_time').slice(0, 5).map((key) => (
                                <th key={key} className="text-left py-1 px-2 text-white/50 font-medium">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.results.slice(0, 8).map((row, i) => (
                              <tr key={i} className="border-b border-white/5">
                                {Object.keys(msg.results![0]).filter((k) => !k.startsWith('_') || k === '_time').slice(0, 5).map((key) => (
                                  <td key={key} className="py-1 px-2 text-white/60 truncate max-w-[150px]">{String(row[key] ?? '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-emerald-900/10 border border-emerald-800/20 rounded-xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></span>
                <span className="text-xs text-white/50">Splunk Assistant is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Splunk Assistant anything..."
          disabled={loading}
          className="flex-1 px-4 py-3 bg-white/5 border border-emerald-800/30 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-5 py-3 bg-emerald-600 disabled:bg-emerald-900/50 text-white text-sm font-medium rounded-xl disabled:opacity-50"
        >
          {loading ? '...' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
