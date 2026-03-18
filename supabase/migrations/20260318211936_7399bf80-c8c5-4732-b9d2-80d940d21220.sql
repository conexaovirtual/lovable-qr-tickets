
-- =====================
-- MÓDULO DE CONTRATOS
-- =====================

-- Tipo de contrato
CREATE TYPE public.contract_type AS ENUM ('bloco_horas', 'ilimitado', 'por_chamado', 'mensal_fixo');
CREATE TYPE public.contract_status AS ENUM ('ativo', 'expirado', 'cancelado', 'pendente');

CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo contract_type NOT NULL DEFAULT 'mensal_fixo',
  status contract_status NOT NULL DEFAULT 'ativo',
  valor_mensal NUMERIC DEFAULT 0,
  horas_contratadas NUMERIC DEFAULT 0,
  horas_consumidas NUMERIC DEFAULT 0,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  renovacao_automatica BOOLEAN DEFAULT false,
  descricao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contracts" ON public.contracts FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Technicians can view contracts" ON public.contracts FOR SELECT USING (has_role(auth.uid(), 'tecnico'::user_role));
CREATE POLICY "Managers can view their company contracts" ON public.contracts FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'gestor_cliente'::user_role)
);

-- Registro de consumo de horas
CREATE TABLE public.contract_hour_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id),
  service_order_id UUID REFERENCES public.service_orders(id),
  tecnico_id UUID REFERENCES public.profiles(id),
  horas NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contract_hour_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract hours" ON public.contract_hour_entries FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Technicians can view and insert contract hours" ON public.contract_hour_entries FOR SELECT USING (has_role(auth.uid(), 'tecnico'::user_role));
CREATE POLICY "Technicians can insert contract hours" ON public.contract_hour_entries FOR INSERT WITH CHECK (has_role(auth.uid(), 'tecnico'::user_role));

-- =====================
-- CMDB - RELACIONAMENTOS
-- =====================

CREATE TYPE public.asset_relationship_type AS ENUM ('hospeda', 'conecta', 'depende_de', 'backup_de', 'virtualiza');

CREATE TABLE public.asset_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  child_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  relationship_type asset_relationship_type NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (parent_asset_id != child_asset_id),
  UNIQUE(parent_asset_id, child_asset_id, relationship_type)
);

ALTER TABLE public.asset_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and technicians can manage asset relationships" ON public.asset_relationships FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));
CREATE POLICY "Users can view relationships of their company assets" ON public.asset_relationships FOR SELECT USING (
  parent_asset_id IN (SELECT id FROM assets WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  OR is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role)
);

-- CMDB - CHANGELOG DE ATIVOS
CREATE TABLE public.asset_changelog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.profiles(id),
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.asset_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and technicians can manage asset changelog" ON public.asset_changelog FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));
CREATE POLICY "Users can view changelog of their company assets" ON public.asset_changelog FOR SELECT USING (
  asset_id IN (SELECT id FROM assets WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  OR is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role)
);

-- Trigger para atualizar horas consumidas no contrato
CREATE OR REPLACE FUNCTION public.update_contract_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE contracts 
  SET horas_consumidas = (
    SELECT COALESCE(SUM(horas), 0) 
    FROM contract_hour_entries 
    WHERE contract_id = NEW.contract_id
  ),
  updated_at = now()
  WHERE id = NEW.contract_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_contract_hours_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.contract_hour_entries
FOR EACH ROW EXECUTE FUNCTION public.update_contract_hours();
