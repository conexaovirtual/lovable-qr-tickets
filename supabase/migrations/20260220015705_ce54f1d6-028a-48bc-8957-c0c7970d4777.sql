
-- Create knowledge_articles table
CREATE TABLE public.knowledge_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  problema TEXT NOT NULL,
  solucao TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  categoria TEXT,
  visualizacoes INTEGER DEFAULT 0,
  util_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

-- Admins and technicians can manage
CREATE POLICY "Admins and technicians can manage knowledge articles"
ON public.knowledge_articles
FOR ALL
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

-- All authenticated users can view
CREATE POLICY "Authenticated users can view knowledge articles"
ON public.knowledge_articles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_articles_updated_at
BEFORE UPDATE ON public.knowledge_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
