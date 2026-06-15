'use client';

import Image from 'next/image';

interface WizardMascotProps {
  reaction?: 'idle' | 'excited' | 'thinking' | 'celebrating' | 'alert';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SignalSage Witch Mascot — Custom PNG image (portrait, transparent background)
 */
export default function WizardMascot({ reaction = 'idle', size = 'md' }: WizardMascotProps) {
  const sizeMap = { sm: 32, md: 44, lg: 80 };
  const containerSizeMap = { sm: 'w-8 h-12', md: 'w-12 h-16', lg: 'w-20 h-28' };
  const gooBadgeSizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' };
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
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-purple-500/30 witch-goo-bubble`} />
      <Image
        src="/witch-mascot.png"
        alt="SignalSage Witch Mascot"
        width={px}
        height={Math.round(px * 1.46)}
        className={`relative z-10 object-contain ${animationClass[reaction]}`}
        style={{
          filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.4))',
        }}
        priority
      />
    </div>
  );
}
