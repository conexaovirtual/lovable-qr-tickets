import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Sparkles } from 'lucide-react';
import { AIDiagnosticAssistant } from './AIDiagnosticAssistant';

interface AIDiagnosticButtonProps {
  contexto: {
    ticket_id?: string;
    daily_service_id?: string;
    asset_id?: string;
    descricao_problema?: string;
  };
  variant?: 'default' | 'outline' | 'ghost' | 'floating';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function AIDiagnosticButton({ 
  contexto, 
  variant = 'outline', 
  size = 'default',
  className 
}: AIDiagnosticButtonProps) {
  const [open, setOpen] = useState(false);

  if (variant === 'floating') {
    return (
      <>
        <Button
          onClick={() => setOpen(true)}
          className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 ${className}`}
          size="icon"
        >
          <Brain className="h-6 w-6" />
          <Sparkles className="h-3 w-3 absolute top-2 right-2 text-yellow-300" />
        </Button>
        <AIDiagnosticAssistant 
          open={open} 
          onOpenChange={setOpen} 
          contexto={contexto} 
        />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant={variant}
        size={size}
        className={className}
      >
        <Brain className="h-4 w-4 mr-2" />
        Ajuda IA
        <Sparkles className="h-3 w-3 ml-1 text-yellow-500" />
      </Button>
      <AIDiagnosticAssistant 
        open={open} 
        onOpenChange={setOpen} 
        contexto={contexto} 
      />
    </>
  );
}
