import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface MetricCard {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string; // tailwind bg class like "bg-emerald-600"
}

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  metrics?: MetricCard[];
}

export function PageHeader({ icon: Icon, title, subtitle, actions, metrics }: PageHeaderProps) {
  return (
    <div className="bg-[hsl(220,25%,16%)] text-white shrink-0">
      <div className="container mx-auto px-4">
        <div className="h-14 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Icon className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate tracking-wide uppercase">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-white/50 leading-tight truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>

        {/* Metric cards row */}
        {metrics && metrics.length > 0 && (
          <div className="pb-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
            {metrics.map((m, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 ${m.color} rounded-lg px-3 py-1.5 shrink-0`}
              >
                <m.icon className="h-3.5 w-3.5 text-white/80" />
                <div>
                  <p className="text-[10px] text-white/70 leading-tight uppercase tracking-wider">
                    {m.label}
                  </p>
                  <p className="text-sm font-bold text-white leading-tight">
                    {m.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
