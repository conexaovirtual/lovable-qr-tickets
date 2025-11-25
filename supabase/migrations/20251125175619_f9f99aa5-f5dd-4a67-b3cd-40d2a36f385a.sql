-- Adicionar campos para chamados públicos via QR Code
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS public_request BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS solicitante_nome TEXT,
ADD COLUMN IF NOT EXISTS solicitante_contato TEXT;

-- Permitir solicitante_id NULL para requests públicos
ALTER TABLE public.tickets 
ALTER COLUMN solicitante_id DROP NOT NULL;

-- Adicionar constraint: se public_request = true, deve ter nome e contato
ALTER TABLE public.tickets
ADD CONSTRAINT check_public_request_fields
CHECK (
  (public_request = FALSE AND solicitante_id IS NOT NULL) OR
  (public_request = TRUE AND solicitante_nome IS NOT NULL AND solicitante_contato IS NOT NULL)
);

-- Criar policy para permitir INSERT público quando for via QR code
CREATE POLICY "Permitir criação de tickets públicos via QR code"
ON public.tickets
FOR INSERT
WITH CHECK (public_request = TRUE);

-- Permitir leitura de tickets públicos apenas pelos dados do token
CREATE POLICY "Tickets públicos podem ser vistos pelo criador"
ON public.tickets
FOR SELECT
USING (
  public_request = TRUE OR
  company_id = get_user_company_id(auth.uid()) OR 
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'tecnico'::user_role)
);