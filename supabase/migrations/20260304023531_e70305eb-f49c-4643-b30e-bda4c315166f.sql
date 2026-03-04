
CREATE TABLE public.ai_assistant_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  chave text NOT NULL,
  valor text NOT NULL,
  contexto jsonb DEFAULT '{}'::jsonb,
  vezes_usado integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tipo, chave)
);

ALTER TABLE public.ai_assistant_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory"
  ON public.ai_assistant_memory FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own memory"
  ON public.ai_assistant_memory FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_ai_memory_user ON public.ai_assistant_memory(user_id);
CREATE INDEX idx_ai_memory_tipo ON public.ai_assistant_memory(user_id, tipo);
