import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  endereco_completo: string;
  telefone: string;
  email: string;
  situacao_cadastral: string;
  ativa: boolean;
}

interface UseCNPJLookupReturn {
  lookupCNPJ: (cnpj: string) => Promise<CNPJData | null>;
  isLoading: boolean;
  error: string | null;
  isRateLimitError: boolean;
}

export const useCNPJLookup = (): UseCNPJLookupReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimitError, setIsRateLimitError] = useState(false);

  const lookupCNPJ = async (cnpj: string): Promise<CNPJData | null> => {
    setIsLoading(true);
    setError(null);
    setIsRateLimitError(false);

    try {
      // Remove formatação do CNPJ
      const cnpjLimpo = cnpj.replace(/[^\d]/g, '');

      // Valida formato
      if (cnpjLimpo.length !== 14) {
        setError('CNPJ deve ter 14 dígitos');
        setIsLoading(false);
        return null;
      }

      const { data, error: functionError } = await supabase.functions.invoke('consultar-cnpj', {
        body: { cnpj: cnpjLimpo },
      });

      if (functionError) {
        console.error('Erro ao consultar CNPJ:', functionError);
        const errorMsg = functionError.message || 'Erro ao consultar CNPJ';
        const isRateLimit = errorMsg.toLowerCase().includes('limite') || errorMsg.includes('429');
        setError(errorMsg);
        setIsRateLimitError(isRateLimit);
        setIsLoading(false);
        return null;
      }

      if (data?.error) {
        const isRateLimit = data.error.toLowerCase().includes('limite') || data.error.includes('429');
        setError(data.error);
        setIsRateLimitError(isRateLimit);
        setIsLoading(false);
        return null;
      }

      setIsLoading(false);
      return data as CNPJData;
    } catch (err: any) {
      console.error('Erro ao consultar CNPJ:', err);
      const errorMsg = err.message || 'Erro ao consultar CNPJ';
      const isRateLimit = errorMsg.toLowerCase().includes('limite') || errorMsg.includes('429');
      setError(errorMsg);
      setIsRateLimitError(isRateLimit);
      setIsLoading(false);
      return null;
    }
  };

  return { lookupCNPJ, isLoading, error, isRateLimitError };
};
