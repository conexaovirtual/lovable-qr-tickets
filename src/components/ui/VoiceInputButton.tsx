import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceInputButtonProps {
  onTranscript?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onProcessingStart?: () => void;
  onProcessingEnd?: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  showTranscript?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  onFinalResult,
  onProcessingStart,
  onProcessingEnd,
  disabled = false,
  className,
  size = 'icon',
  showTranscript = false,
}: VoiceInputButtonProps) {
  const [displayTranscript, setDisplayTranscript] = useState('');

  const {
    status,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        onTranscript?.(text);
      }
      setDisplayTranscript(transcript + interimTranscript);
    },
    onFinalResult: (text) => {
      onFinalResult?.(text);
      setDisplayTranscript('');
      resetTranscript();
    },
    onError: (error) => {
      console.error('Voice input error:', error);
      onProcessingEnd?.();
    },
    onStatusChange: (newStatus) => {
      if (newStatus === 'processing') {
        onProcessingStart?.();
      } else if (newStatus === 'idle' || newStatus === 'error') {
        onProcessingEnd?.();
      }
    },
  });

  useEffect(() => {
    setDisplayTranscript(transcript + interimTranscript);
  }, [transcript, interimTranscript]);

  const handleClick = () => {
    if (status === 'listening') {
      stopListening();
    } else {
      resetTranscript();
      setDisplayTranscript('');
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size={size}
              disabled
              className={cn('opacity-50', className)}
            >
              <MicOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reconhecimento de voz não suportado neste navegador</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isListening = status === 'listening';
  const isProcessing = status === 'processing';
  const isError = status === 'error';

  return (
    <div className={cn('flex flex-col gap-2', showTranscript && 'w-full')}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size={size}
              disabled={disabled || isProcessing}
              onClick={handleClick}
              className={cn(
                'relative transition-all duration-200',
                isListening && 'animate-pulse shadow-lg shadow-destructive/30',
                isError && 'border-destructive',
                className
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isError ? (
                <AlertCircle className="h-4 w-4" />
              ) : isListening ? (
                <>
                  <Mic className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                  </span>
                </>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isListening ? (
              <p>Clique para parar</p>
            ) : isProcessing ? (
              <p>Processando...</p>
            ) : isError ? (
              <p>Erro - clique para tentar novamente</p>
            ) : (
              <p>Clique para falar</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showTranscript && isListening && displayTranscript && (
        <div className="p-3 rounded-md bg-muted text-sm animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            <span className="text-xs font-medium">Ouvindo...</span>
          </div>
          <p className="text-foreground">{displayTranscript}</p>
        </div>
      )}
    </div>
  );
}
