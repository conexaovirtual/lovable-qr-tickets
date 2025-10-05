-- Criar funções com search_path para segurança

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Função para calcular prioridade
CREATE OR REPLACE FUNCTION public.calculate_priority(p_impacto impact_level, p_urgencia urgency_level)
RETURNS priority_level
LANGUAGE plpgsql
IMMUTABLE
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

-- Função para definir prioridade do chamado
CREATE OR REPLACE FUNCTION public.set_ticket_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.prioridade := calculate_priority(NEW.impacto, NEW.urgencia);
  RETURN NEW;
END;
$$;

-- Função para definir SLA do chamado
CREATE OR REPLACE FUNCTION public.set_ticket_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Função para registrar datas de atendimento
CREATE OR REPLACE FUNCTION public.set_first_response_time()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Função para criar perfil ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    'solicitante'
  );
  RETURN NEW;
END;
$$;

-- Criar triggers (usando DROP IF EXISTS para evitar duplicação)
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_ticket_priority_trigger ON public.tickets;
CREATE TRIGGER set_ticket_priority_trigger
  BEFORE INSERT OR UPDATE OF impacto, urgencia ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_priority();

DROP TRIGGER IF EXISTS set_ticket_sla_trigger ON public.tickets;
CREATE TRIGGER set_ticket_sla_trigger
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_sla();

DROP TRIGGER IF EXISTS set_first_response_time_trigger ON public.tickets;
CREATE TRIGGER set_first_response_time_trigger
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_first_response_time();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();