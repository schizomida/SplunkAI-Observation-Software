'use client';

import { useState, useEffect } from 'react';

const LOADING_STEPS = [
  { message: 'Registering incident', icon: '📋' },
  { message: 'Running SPL queries against Splunk', icon: '🔍' },
  { message: 'Analyzing evidence patterns', icon: '🧩' },
  { message: 'Generating root cause hypotheses', icon: '🧠' },
  { message: 'Building remediation plan', icon: '🛠️' },
];

export default function LoadingSkeleton() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-lg mx-auto py-12">
      {/* Spinner */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-white/10" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-indigo-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg">{LOADING_STEPS[currentStep].icon}</span>
          </div>
        </div>
      </div>

      {/* Current step message */}
      <div className="text-center mb-8">
        <p className="text-lg font-medium text-white">
          {LOADING_STEPS[currentStep].message}
          <span className="loading-dot-1">.</span>
          <span className="loading-dot-2">.</span>
          <span className="loading-dot-3">.</span>
        </p>
        <p className="text-sm text-white/50 mt-1">
          Step {currentStep + 1} of {LOADING_STEPS.length}
        </p>
      </div>

      {/* Progress steps */}
      <div className="space-y-3">
        {LOADING_STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 ${
              i < currentStep
                ? 'bg-green-500/10 border border-green-400/20'
                : i === currentStep
                  ? 'bg-indigo-500/10 border border-indigo-400/20 animate-fade-in-up'
                  : 'bg-white/5 border border-white/10 opacity-50'
            }`}
          >
            <div className="flex-shrink-0">
              {i < currentStep ? (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs">✓</span>
              ) : i === currentStep ? (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs animate-pulse">
                  {i + 1}
                </span>
              ) : (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white/50 text-xs">
                  {i + 1}
                </span>
              )}
            </div>
            <span
              className={`text-sm font-medium ${
                i < currentStep
                  ? 'text-green-300'
                  : i === currentStep
                    ? 'text-indigo-300'
                    : 'text-white/40'
              }`}
            >
              {step.message}
            </span>
            <span className="ml-auto text-sm">{step.icon}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-6 w-full bg-white/10 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
          style={{ width: `${((currentStep + 1) / LOADING_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
