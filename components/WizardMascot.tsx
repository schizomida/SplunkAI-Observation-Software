'use client';

import Image from 'next/image';

interface WizardMascotProps {
  reaction?: 'idle' | 'excited' | 'thinking' | 'celebrating' | 'alert';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SignalSage Witch Mascot
 * Uses the AI-generated witch illustration with CSS animations.
 */
export default function WizardMascot({ reaction = 'idle', size = 'md' }: WizardMascotProps) {
  const sizeMap = {
    sm: { width: 36, height: 36, container: 'w-10 h-10' },
    md: { width: 48, height: 48, container: 'w-14 h-14' },
    lg: { width: 80, height: 80, container: 'w-24 h-24' },
  };

  const gooBadgeSizeMap = {
    sm: 'w-9 h-9',
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

  const { width, height, container } = sizeMap[size];

  return (
    <div className={`relative inline-flex items-center justify-center ${container}`}>
      {/* Purple goo badge */}
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-purple-500/40 witch-goo-bubble`} />
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-fuchsia-500/20 witch-goo-bubble-2`} />
      {/* Witch image with reaction animation */}
      <div
        className={`relative z-10 ${animationClass[reaction]} witch-jiggly`}
        style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.4))' }}
      >
        <Image
          src="/witch-mascot.png"
          alt="SignalSage Witch"
          width={width}
          height={height}
          className="rounded-full object-cover object-top"
          priority
        />
      </div>
    </div>
  );
}
