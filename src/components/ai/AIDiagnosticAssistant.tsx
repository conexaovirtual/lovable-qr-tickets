import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Send, Loader2, CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DiagnosticResult {
  resposta: string;
  passos_diagnostico: Array<{ ordem: number; descricao: string; importante: boolean }>;
  solucoes_anteriores: Array<{ titulo: string; resumo: string; data: string }>;
  nivel_confianca: 'alto' | 'medio' | 'baixo';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: DiagnosticResult;
}

interface AIDiagnosticAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contexto: {
    ticket_id?: string;
    daily_service_id?: string;
    asset_id?: string;
    descricao_problema?: string;
  };
}

export function AIDiagnosticAssistant({ open, onOpenChange, contexto }: AIDiagnosticAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      // Mensagem inicial de boas-vindas
      setMessages([{
        role: 'assistant',
        content: 'Olá! Sou o assistente de diagnóstico. Posso ajudá-lo a diagnosticar problemas e encontrar soluções baseadas no histórico. O que você gostaria de saber?'
      }]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-diagnostic-assistant', {
        body: {
          contexto,
          pergunta: userMessage
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.resposta,
        data
      }]);
    } catch (err: any) {
      console.error('Erro no diagnóstico:', err);
      toast.error('Erro ao consultar IA');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'bg-green-500';
      case 'medio': return 'bg-yellow-500';
      case 'baixo': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const suggestedQuestions = [
    'O que pode estar causando esse problema?',
    'Quais passos de diagnóstico devo seguir?',
    'Já tivemos problemas similares antes?',
    'Qual a solução mais comum para isso?'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Assistente de Diagnóstico IA
          </DialogTitle>
          <DialogDescription>
            Faça perguntas sobre o problema e receba sugestões de diagnóstico baseadas no histórico.
          </DialogDescription>
        </DialogHeader>

        {/* Área de mensagens */}
        <ScrollArea className="flex-1 pr-4 max-h-[400px]" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Dados adicionais da IA */}
                  {msg.data && (
                    <div className="mt-3 space-y-3">
                      {/* Nível de confiança */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${getConfidenceColor(msg.data.nivel_confianca)}`} />
                        Confiança: {msg.data.nivel_confianca}
                      </div>

                      {/* Passos de diagnóstico */}
                      {msg.data.passos_diagnostico.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Passos de Diagnóstico:
                          </p>
                          <div className="space-y-1">
                            {msg.data.passos_diagnostico.map((passo, i) => (
                              <div
                                key={i}
                                className={`text-xs p-2 rounded ${
                                  passo.importante
                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-2 border-yellow-500'
                                    : 'bg-background/50'
                                }`}
                              >
                                <span className="font-medium mr-1">{passo.ordem}.</span>
                                {passo.descricao}
                                {passo.importante && (
                                  <AlertCircle className="h-3 w-3 inline ml-1 text-yellow-600" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Soluções anteriores */}
                      {msg.data.solucoes_anteriores.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <Lightbulb className="h-3 w-3" />
                            Soluções Anteriores:
                          </p>
                          <div className="space-y-1">
                            {msg.data.solucoes_anteriores.slice(0, 3).map((sol, i) => (
                              <div key={i} className="text-xs p-2 bg-background/50 rounded">
                                <p className="font-medium">{sol.titulo}</p>
                                <p className="text-muted-foreground">{sol.resumo}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analisando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Sugestões rápidas */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 py-2">
            {suggestedQuestions.map((q, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setInput(q);
                }}
              >
                {q}
              </Button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
