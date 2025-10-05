import { Progress } from '@/components/ui/progress'

interface PasswordStrengthIndicatorProps {
  strength: number // 0-4
}

export function PasswordStrengthIndicator({ strength }: PasswordStrengthIndicatorProps) {
  const strengthConfig = [
    { label: 'Muito fraca', color: 'bg-destructive' },
    { label: 'Fraca', color: 'bg-orange-500' },
    { label: 'Razoável', color: 'bg-yellow-500' },
    { label: 'Boa', color: 'bg-lime-500' },
    { label: 'Forte', color: 'bg-green-500' }
  ]
  
  if (strength === 0) return null

  const config = strengthConfig[strength]

  return (
    <div className="space-y-1">
      <Progress value={(strength + 1) * 20} className="h-2" />
      <p className="text-xs text-muted-foreground">
        Força da senha: <span className={`font-medium ${config.color.replace('bg-', 'text-')}`}>
          {config.label}
        </span>
      </p>
    </div>
  )
}
