-- Create enum for visit frequency
CREATE TYPE public.visit_frequency AS ENUM ('semanal', 'quinzenal', 'mensal', 'trimestral');

-- Create enum for visit priority
CREATE TYPE public.visit_priority AS ENUM ('alta', 'media', 'baixa');

-- Create enum for visit status
CREATE TYPE public.visit_status AS ENUM ('pendente', 'agendada', 'concluida', 'cancelada', 'atrasada');

-- Create enum for visit reason
CREATE TYPE public.visit_reason AS ENUM ('preventiva', 'corretiva', 'acompanhamento');

-- Create table for visit schedules
CREATE TABLE public.visit_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  frequencia visit_frequency NOT NULL DEFAULT 'mensal',
  proxima_visita DATE NOT NULL,
  ultima_visita DATE,
  motivo visit_reason NOT NULL DEFAULT 'preventiva',
  prioridade visit_priority NOT NULL DEFAULT 'media',
  status visit_status NOT NULL DEFAULT 'pendente',
  ai_justificativa TEXT,
  tecnico_responsavel_id UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visit_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage visit schedules
CREATE POLICY "Admins can view all visit schedules"
ON public.visit_schedules
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert visit schedules"
ON public.visit_schedules
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update visit schedules"
ON public.visit_schedules
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete visit schedules"
ON public.visit_schedules
FOR DELETE
USING (is_admin(auth.uid()));

-- Technicians can view their assigned visits
CREATE POLICY "Technicians can view their assigned visits"
ON public.visit_schedules
FOR SELECT
USING (
  has_role(auth.uid(), 'tecnico') 
  AND tecnico_responsavel_id = auth.uid()
);

-- Trigger for updated_at
CREATE TRIGGER update_visit_schedules_updated_at
BEFORE UPDATE ON public.visit_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_visit_schedules_company_id ON public.visit_schedules(company_id);
CREATE INDEX idx_visit_schedules_proxima_visita ON public.visit_schedules(proxima_visita);
CREATE INDEX idx_visit_schedules_status ON public.visit_schedules(status);
CREATE INDEX idx_visit_schedules_prioridade ON public.visit_schedules(prioridade);