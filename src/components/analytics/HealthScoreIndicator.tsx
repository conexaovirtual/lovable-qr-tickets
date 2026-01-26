import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HealthScoreIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HealthScoreIndicator({ score, size = 'md', showLabel = true }: HealthScoreIndicatorProps) {
  const getHealthStatus = (score: number) => {
    if (score >= 70) return { label: 'Saudável', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 };
    if (score >= 40) return { label: 'Atenção', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Activity };
    return { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle };
  };

  const status = getHealthStatus(score);
  const Icon = status.icon;

  const sizes = {
    sm: { container: 'h-8 w-8', icon: 'h-4 w-4', text: 'text-xs' },
    md: { container: 'h-12 w-12', icon: 'h-6 w-6', text: 'text-sm' },
    lg: { container: 'h-16 w-16', icon: 'h-8 w-8', text: 'text-base' }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'rounded-full flex items-center justify-center',
        status.bg,
        sizes[size].container
      )}>
        <Icon className={cn(status.color, sizes[size].icon)} />
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className={cn('font-semibold', status.color, sizes[size].text)}>
            {score}%
          </span>
          <span className="text-xs text-muted-foreground">{status.label}</span>
        </div>
      )}
    </div>
  );
}
