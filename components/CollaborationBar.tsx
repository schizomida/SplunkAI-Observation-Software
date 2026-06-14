'use client';

import { useState, useEffect } from 'react';
import { playClickSound, playSuccessSound } from '@/lib/sounds';

interface TeamMember {
  name: string;
  initials: string;
  color: string;
  status: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Josh C', initials: 'JC', color: 'bg-indigo-500', status: 'investigating' },
  { name: 'Alex M', initials: 'AM', color: 'bg-emerald-500', status: 'viewing report' },
  { name: 'Sarah K', initials: 'SK', color: 'bg-pink-500', status: 'reviewing remediation' },
];

export default function CollaborationBar() {
  const [copied, setCopied] = useState(false);
  const [activeMembers, setActiveMembers] = useState<boolean[]>([true, true, false]);

  // Simulate activity by toggling member active states periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMembers((prev) => {
        const newState = [...prev];
        const randomIndex = Math.floor(Math.random() * TEAM_MEMBERS.length);
        newState[randomIndex] = !newState[randomIndex];
        // Ensure at least one member is always active
        if (!newState.some(Boolean)) {
          newState[0] = true;
        }
        return newState;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const activeCount = activeMembers.filter(Boolean).length;

  // Pick a random active member for the status message
  const activeIndices = activeMembers
    .map((active, i) => (active ? i : -1))
    .filter((i) => i >= 0);
  const featuredMember = TEAM_MEMBERS[activeIndices[0] ?? 0];

  async function handleShare() {
    playClickSound();
    try {
      await navigator.clipboard.writeText(window.location.href);
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
    <div className="glass-card border-b border-white/10 animate-fade-in-up">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
        {/* Left: Team member avatars */}
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-2">
            {TEAM_MEMBERS.map((member, i) => (
              <div
                key={member.initials}
                className={`relative w-7 h-7 rounded-full ${member.color} flex items-center justify-center text-[10px] font-bold text-white border-2 border-slate-900 group`}
                title={`${member.name} — ${member.status}`}
              >
                {member.initials}
                {/* Activity indicator dot */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 transition-colors duration-300 ${
                    activeMembers[i] ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Status text */}
          <div className="text-xs text-white/50 hidden sm:block">
            <span className="text-emerald-400 font-medium">{activeCount} engineer{activeCount !== 1 ? 's' : ''}</span>
            {' investigating • '}
            <span className="text-white/70">{featuredMember.name}</span>
            {' is '}
            <span className="text-white/60">{featuredMember.status}</span>
          </div>
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
              Share
            </>
          )}
        </button>
      </div>
    </div>
  );
}
