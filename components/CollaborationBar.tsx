'use client';

import { useState, useEffect } from 'react';
import { playClickSound, playSuccessSound } from '@/lib/sounds';

interface Collaborator {
  initials: string;
  name: string;
  color: string;
  viewing: string;
}

export default function CollaborationBar() {
  const [investigationId, setInvestigationId] = useState('');
  const [copied, setCopied] = useState(false);
  const [collaborators] = useState<Collaborator[]>([
    { initials: 'You', name: 'You', color: 'bg-indigo-500', viewing: 'Current Tab' },
    { initials: 'JL', name: 'Judge Lee', color: 'bg-emerald-500', viewing: 'Root Cause' },
  ]);

  useEffect(() => {
    // Generate a stable investigation ID on mount
    const id = `live-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    setInvestigationId(id);
  }, []);

  async function handleShare() {
    playClickSound();
    const url = `${window.location.origin}/investigate/${investigationId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      playSuccessSound();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard not available
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bg-white/[0.03] border-b border-white/10 animate-fade-in-up">
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between">
        {/* Left: Collaborators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-2">
            {collaborators.map((c) => (
              <div
                key={c.initials}
                className={`w-7 h-7 rounded-full ${c.color} flex items-center justify-center text-[10px] font-bold text-white border-2 border-slate-900 relative group`}
                title={`${c.name} — viewing ${c.viewing}`}
              >
                {c.initials}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
              </div>
            ))}
          </div>
          <div className="text-xs text-white/40 hidden sm:block">
            <span className="text-emerald-400 font-medium">JL</span> is viewing <span className="text-white/60">Root Cause</span>
          </div>
        </div>

        {/* Center: Investigation ID */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Investigation ID:</span>
          <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
            {investigationId}
          </span>
        </div>

        {/* Right: Share button */}
        <button
          onClick={handleShare}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all btn-press ${
            copied
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10'
          }`}
        >
          {copied ? (
            <>
              <span>✓</span> Copied!
            </>
          ) : (
            <>
              <span>🔗</span> Share Investigation
            </>
          )}
        </button>
      </div>
    </div>
  );
}
