'use client';

interface WizardMascotProps {
  reaction?: 'idle' | 'excited' | 'thinking' | 'celebrating' | 'alert';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SignalSage Witch Mascot
 * A modern, stylish SVG witch with purple magic effects.
 * Uses CSS animations for jiggly/bouncy personality.
 */
export default function WizardMascot({ reaction = 'idle', size = 'md' }: WizardMascotProps) {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 64,
  };

  const containerSizeMap = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
  };

  const gooBadgeSizeMap = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };

  const animationClass = {
    idle: 'witch-idle',
    excited: 'witch-excited',
    thinking: 'witch-thinking',
    celebrating: 'witch-celebrating',
    alert: 'witch-alert',
  };

  const px = sizeMap[size];

  return (
    <div className={`relative inline-flex items-center justify-center ${containerSizeMap[size]}`}>
      {/* Purple goo badge - bubbly pulsing background */}
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-purple-500/50 witch-goo-bubble`} />
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-fuchsia-500/30 witch-goo-bubble-2`} />
      {/* SVG Witch with reaction animation */}
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 ${animationClass[reaction]} witch-jiggly`}
        style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))' }}
      >
        {/* Pointed hat */}
        <path
          d="M32 2L22 26h20L32 2z"
          fill="url(#hatGradient)"
          stroke="#7c3aed"
          strokeWidth="0.5"
        />
        {/* Hat brim */}
        <ellipse cx="32" cy="26" rx="14" ry="3" fill="#4c1d95" stroke="#7c3aed" strokeWidth="0.5" />
        {/* Hat band */}
        <rect x="24" y="23" width="16" height="3" rx="1" fill="#c084fc" opacity="0.8" />
        {/* Hat star accent */}
        <path d="M29 14l1 2.5L32.5 15l-1.5 2 2.5 1-2.5 0.5L32.5 21 30.5 19.5 29 21l0.5-2.5L27 17.5l2.5-1L29 14z" fill="#e9d5ff" opacity="0.9" />
        {/* Head / face */}
        <ellipse cx="32" cy="34" rx="9" ry="10" fill="#fde68a" />
        {/* Eyes */}
        <ellipse cx="29" cy="33" rx="1.5" ry="2" fill="#1e1b4b" />
        <ellipse cx="35" cy="33" rx="1.5" ry="2" fill="#1e1b4b" />
        {/* Eye shine */}
        <circle cx="29.5" cy="32.5" r="0.5" fill="white" />
        <circle cx="35.5" cy="32.5" r="0.5" fill="white" />
        {/* Smirk mouth */}
        <path d="M29 38c1.5 1.5 4 1.5 5.5 0" stroke="#92400e" strokeWidth="1" strokeLinecap="round" fill="none" />
        {/* Hair flowing left */}
        <path
          d="M23 26c-2 4-3 10-1 16"
          stroke="url(#hairGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Hair flowing right */}
        <path
          d="M41 26c2 4 3 10 1 16"
          stroke="url(#hairGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Hair middle strands */}
        <path
          d="M25 27c-1 5-2 8 0 14"
          stroke="url(#hairGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M39 27c1 5 2 8 0 14"
          stroke="url(#hairGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        {/* Wand / staff */}
        <line x1="44" y1="38" x2="56" y2="52" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
        {/* Wand orb glow (outer) */}
        <circle cx="57" cy="53" r="5" fill="#a855f7" opacity="0.3">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Wand orb glow (middle) */}
        <circle cx="57" cy="53" r="3" fill="#c084fc" opacity="0.6">
          <animate attributeName="r" values="2.5;3.5;2.5" dur="1.5s" repeatCount="indefinite" />
        </circle>
        {/* Wand orb (core) */}
        <circle cx="57" cy="53" r="2" fill="#e9d5ff" />
        {/* Body silhouette (cloak) */}
        <path
          d="M24 44c0 0-4 8-6 18h28c-2-10-6-18-6-18"
          fill="url(#cloakGradient)"
          opacity="0.9"
        />
        {/* Gradients */}
        <defs>
          <linearGradient id="hatGradient" x1="32" y1="2" x2="32" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#581c87" />
            <stop offset="100%" stopColor="#3b0764" />
          </linearGradient>
          <linearGradient id="hairGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id="cloakGradient" x1="32" y1="44" x2="32" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>
      </svg>
      {/* Magic sparkles */}
      <span className="absolute -top-1 -right-1 text-xs witch-sparkle">✨</span>
      {size === 'lg' && (
        <>
          <span className="absolute -bottom-1 -left-1 text-xs witch-sparkle-2">💜</span>
          <span className="absolute top-0 left-0 text-xs witch-sparkle-3">⭐</span>
        </>
      )}
    </div>
  );
}
