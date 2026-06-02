'use client';

interface WizardMascotProps {
  reaction?: 'idle' | 'excited' | 'thinking' | 'celebrating' | 'alert';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SignalSage Witch Mascot
 * A bubbly, animated witch character with purple magic effects.
 * Uses CSS animations for jiggly/bouncy personality.
 */
export default function WizardMascot({ reaction = 'idle', size = 'md' }: WizardMascotProps) {
  const sizeMap = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-5xl',
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

  return (
    <div className={`relative inline-flex items-center justify-center ${containerSizeMap[size]}`}>
      {/* Purple goo badge - bubbly pulsing background */}
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-purple-500/50 witch-goo-bubble`} />
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-fuchsia-500/30 witch-goo-bubble-2`} />
      {/* Witch emoji with reaction animation */}
      <span className={`relative z-10 ${sizeMap[size]} ${animationClass[reaction]} witch-jiggly`}>
        🧙‍♀️
      </span>
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
