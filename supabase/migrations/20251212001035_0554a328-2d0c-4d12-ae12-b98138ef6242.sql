-- Adicionar política para técnicos verem todos os atendimentos diários
CREATE POLICY "Technicians can view all daily records" 
ON public.daily_service_records 
FOR SELECT 
USING (has_role(auth.uid(), 'tecnico'::user_role));