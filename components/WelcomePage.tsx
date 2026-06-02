'use client';

import { useEffect, useState } from 'react';
import SplunkHealthBadge from './SplunkHealthBadge';
import WizardMascot from './WizardMascot';
import { playStartSound, playClickSound } from '@/lib/sounds';

interface WelcomePageProps {
  onStart: () => void;
}

const FEATURES = [
  { icon: '🔍', label: '12 Investigation Queries', delay: 'stagger-1' },
  { icon: '🧠', label: '10 ML Analyses', delay: 'stagger-2' },
  { icon: '⚡', label: '7 Root Cause Scorers', delay: 'stagger-3' },
];

export default function WelcomePage({ onStart }: WelcomePageProps) {
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animations after mount
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  function handleStart() {
    playStartSound();
    setExiting(true);
    // Wait for animation to finish
    setTimeout(() => onStart(), 600);
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 transition-all duration-600 ${exiting ? 'animate-explode-out' : ''}`}>
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
        <div className="absolute top-10 right-10 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-10 left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Content */}
      <div className={`relative z-10 text-center px-6 max-w-2xl transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Logo / Title */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 mb-6 animate-glow">
            <WizardMascot reaction="idle" size="lg" />
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-4">
            SignalSage
          </h1>
          <p className="text-xl text-indigo-200/80 font-medium">
            AI-Powered Incident Investigation for Splunk
          </p>
        </div>

        {/* Splunk connection status */}
        <div className={`mb-10 flex justify-center transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="glass-card rounded-full px-4 py-2 inline-flex items-center gap-2">
            <SplunkHealthBadge />
          </div>
        </div>

        {/* Feature highlights */}
        <div className={`flex flex-wrap justify-center gap-4 mb-10 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {FEATURES.map((feature) => (
            <div
              key={feature.label}
              className={`glass-card rounded-xl px-4 py-3 flex items-center gap-2 ${feature.delay}`}
            >
              <span className="text-lg">{feature.icon}</span>
              <span className="text-sm font-medium text-white/90">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Start button */}
        <div className={`transition-all duration-700 delay-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <button
            onClick={handleStart}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 btn-press glow-indigo"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">🚀</span>
            <span>Start Investigation</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="mt-4 text-sm text-indigo-300/60">
            Requires a live Splunk connection
          </p>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
    </div>
  );
}
