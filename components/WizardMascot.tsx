'use client';

interface WizardMascotProps {
  reaction?: 'idle' | 'excited' | 'thinking' | 'celebrating' | 'alert';
  size?: 'sm' | 'md' | 'lg';
}

export default function WizardMascot({ reaction = 'idle', size = 'md' }: WizardMascotProps) {
  const sizeMap = {
    sm: 'text-2xl',
    md: 'text-2xl',
    lg: 'text-5xl',
  };

  const containerSizeMap = {
    sm: 'w-10 h-10',
    md: 'w-10 h-10',
    lg: 'w-20 h-20',
  };

  const gooBadgeSizeMap = {
    sm: 'w-8 h-8',
    md: 'w-8 h-8',
    lg: 'w-16 h-16',
  };

  const animationClass = {
    idle: 'wizard-idle',
    excited: 'wizard-excited',
    thinking: 'wizard-thinking',
    celebrating: 'wizard-celebrating',
    alert: 'wizard-alert',
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${containerSizeMap[size]}`}>
      {/* Purple goo badge - pulsing background */}
      <div className={`absolute ${gooBadgeSizeMap[size]} rounded-full bg-purple-500/40 wizard-goo-pulse`} />
      {/* Wizard emoji with reaction animation */}
      <span className={`relative z-10 ${sizeMap[size]} ${animationClass[reaction]}`}>
        🧙‍♂️
      </span>
    </div>
  );
}
