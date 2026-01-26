import { useState, useCallback, useRef, useEffect } from 'react';

type VoiceInputStatus = 'idle' | 'listening' | 'processing' | 'error';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseVoiceInputOptions {
  language?: string;
  continuous?: boolean;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: VoiceInputStatus) => void;
}

interface UseVoiceInputReturn {
  status: VoiceInputStatus;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    language = 'pt-BR',
    continuous = true,
    onTranscript,
    onFinalResult,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  const isSupported = typeof window !== 'undefined' && 
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const updateStatus = useCallback((newStatus: VoiceInputStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const errorMsg = 'Reconhecimento de voz não suportado neste navegador';
      onError?.(errorMsg);
      updateStatus('error');
      return;
    }

    if (isListeningRef.current) return;

    try {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) return;

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        isListeningRef.current = true;
        updateStatus('listening');
        // Feedback háptico em dispositivos móveis
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          
          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interim += text;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          onTranscript?.(finalTranscript, true);
        }
        
        setInterimTranscript(interim);
        if (interim) {
          onTranscript?.(interim, false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        isListeningRef.current = false;
        
        let errorMessage = 'Erro no reconhecimento de voz';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'Nenhuma fala detectada. Tente novamente.';
            break;
          case 'audio-capture':
            errorMessage = 'Microfone não encontrado. Verifique as permissões.';
            break;
          case 'not-allowed':
            errorMessage = 'Permissão de microfone negada.';
            break;
          case 'network':
            errorMessage = 'Erro de rede. Verifique sua conexão.';
            break;
          case 'aborted':
            // Ignorar - usuário parou manualmente
            updateStatus('idle');
            return;
        }
        
        onError?.(errorMessage);
        updateStatus('error');
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        if (status === 'listening') {
          // Se tinha texto, notificar resultado final
          const fullTranscript = transcript + interimTranscript;
          if (fullTranscript.trim()) {
            onFinalResult?.(fullTranscript.trim());
          }
          updateStatus('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Erro ao iniciar reconhecimento:', error);
      onError?.('Erro ao iniciar reconhecimento de voz');
      updateStatus('error');
    }
  }, [isSupported, continuous, language, onTranscript, onFinalResult, onError, updateStatus, status, transcript, interimTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
      isListeningRef.current = false;
      
      // Notificar resultado final
      const fullTranscript = (transcript + interimTranscript).trim();
      if (fullTranscript) {
        onFinalResult?.(fullTranscript);
      }
      
      // Feedback háptico
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
      
      updateStatus('idle');
    }
  }, [transcript, interimTranscript, onFinalResult, updateStatus]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    status,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
