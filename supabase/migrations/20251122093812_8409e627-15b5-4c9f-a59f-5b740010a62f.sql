-- Criar tabelas para categorias e subcategorias de ativos
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.asset_categories(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, nome)
);

-- Adicionar colunas de categoria aos ativos
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES public.asset_subcategories(id) ON DELETE SET NULL;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_assets_categoria_id ON public.assets(categoria_id);
CREATE INDEX IF NOT EXISTS idx_assets_subcategoria_id ON public.assets(subcategoria_id);
CREATE INDEX IF NOT EXISTS idx_asset_subcategories_category_id ON public.asset_subcategories(category_id);

-- Popular categorias iniciais
INSERT INTO public.asset_categories (nome, descricao, cor) VALUES
  ('Computadores', 'Desktops, Notebooks e Servidores', '#3B82F6'),
  ('Periféricos', 'Impressoras, Monitores e Acessórios', '#8B5CF6'),
  ('Rede', 'Roteadores, Switches e Infraestrutura', '#10B981'),
  ('Telefonia', 'Telefones IP e Sistemas de Comunicação', '#F59E0B'),
  ('Armazenamento', 'NAS, Storage e Backup', '#EF4444'),
  ('Outros', 'Equipamentos Diversos', '#6B7280')
ON CONFLICT (nome) DO NOTHING;

-- Popular subcategorias iniciais
INSERT INTO public.asset_subcategories (category_id, nome)
SELECT c.id, s.nome FROM public.asset_categories c
CROSS JOIN (VALUES
  ('Computadores', 'Desktop Corporativo'),
  ('Computadores', 'Notebook Executivo'),
  ('Computadores', 'Notebook Básico'),
  ('Computadores', 'Servidor Torre'),
  ('Computadores', 'Servidor Rack'),
  ('Periféricos', 'Impressora Laser'),
  ('Periféricos', 'Impressora Jato de Tinta'),
  ('Periféricos', 'Monitor LED'),
  ('Periféricos', 'Monitor LCD'),
  ('Periféricos', 'Mouse e Teclado'),
  ('Rede', 'Roteador Corporativo'),
  ('Rede', 'Switch Gerenciável'),
  ('Rede', 'Access Point'),
  ('Telefonia', 'Telefone IP'),
  ('Telefonia', 'PABX'),
  ('Armazenamento', 'NAS'),
  ('Armazenamento', 'Storage Externo')
) AS s(categoria, nome)
WHERE c.nome = s.categoria
ON CONFLICT (category_id, nome) DO NOTHING;

-- Políticas RLS para asset_categories
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view asset categories"
  ON public.asset_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage asset categories"
  ON public.asset_categories FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Políticas RLS para asset_subcategories
ALTER TABLE public.asset_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view asset subcategories"
  ON public.asset_subcategories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage asset subcategories"
  ON public.asset_subcategories FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Comentários para documentação
COMMENT ON TABLE public.asset_categories IS 'Categorias de ativos/equipamentos';
COMMENT ON TABLE public.asset_subcategories IS 'Subcategorias de ativos vinculadas às categorias';
COMMENT ON COLUMN public.assets.categoria_id IS 'Referência à categoria do ativo';
COMMENT ON COLUMN public.assets.subcategoria_id IS 'Referência à subcategoria do ativo';