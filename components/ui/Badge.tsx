import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
  success: 'bg-cdm-success-soft text-[#15803d]',
  warning: 'bg-cdm-highlight-soft text-[#a16207]',
  danger: 'bg-cdm-accent-soft text-[#be123c]',
  info: 'bg-cdm-info-soft text-[#1d4ed8]',
};

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
