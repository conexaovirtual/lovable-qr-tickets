-- Corrigir search_path das funções para segurança
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ticket_priority()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.prioridade := calculate_priority(NEW.impacto, NEW.urgencia);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ticket_sla()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
BEGIN
  SELECT sla_primeiro_atendimento_horas, sla_solucao_horas 
  INTO company_record 
  FROM companies 
  WHERE id = NEW.company_id;
  
  IF company_record IS NOT NULL THEN
    NEW.sla_atendimento_limite := NEW.created_at + (company_record.sla_primeiro_atendimento_horas || ' hours')::INTERVAL;
    NEW.sla_solucao_limite := NEW.created_at + (company_record.sla_solucao_horas || ' hours')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_first_response_time()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'novo' AND NEW.status != 'novo' AND OLD.data_primeiro_atendimento IS NULL THEN
    NEW.data_primeiro_atendimento := NOW();
  END IF;
  
  IF NEW.status = 'resolvido' AND OLD.status != 'resolvido' AND NEW.data_solucao IS NULL THEN
    NEW.data_solucao := NOW();
  END IF;
  
  IF NEW.status = 'fechado' AND OLD.status != 'fechado' AND NEW.data_fechamento IS NULL THEN
    NEW.data_fechamento := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_priority(p_impacto impact_level, p_urgencia urgency_level)
RETURNS priority_level 
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_impacto = 'alto' AND p_urgencia = 'alta' THEN
    RETURN 'critica';
  ELSIF (p_impacto = 'alto' AND p_urgencia = 'media') OR (p_impacto = 'medio' AND p_urgencia = 'alta') THEN
    RETURN 'alta';
  ELSIF (p_impacto = 'alto' AND p_urgencia = 'baixa') OR (p_impacto = 'medio' AND p_urgencia = 'media') OR (p_impacto = 'baixo' AND p_urgencia = 'alta') THEN
    RETURN 'media';
  ELSE
    RETURN 'baixa';
  END IF;
END;
$$;