-- Criar tabelas (os tipos ENUM já existem)

-- Tabela de empresas/clientes
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  status BOOLEAN DEFAULT true,
  sla_primeiro_atendimento_horas INTEGER DEFAULT 4,
  sla_solucao_horas INTEGER DEFAULT 16,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'solicitante',
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de subcategorias
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de ativos
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo asset_type NOT NULL,
  fabricante TEXT,
  modelo TEXT,
  numero_serie TEXT,
  tag_patrimonial TEXT,
  local TEXT,
  setor TEXT,
  sistema_operacional TEXT,
  estado asset_status DEFAULT 'em_uso',
  data_compra DATE,
  garantia_fim DATE,
  configuracoes JSONB,
  qrcode_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de chamados
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL REFERENCES public.profiles(id),
  tecnico_id UUID REFERENCES public.profiles(id),
  asset_id UUID REFERENCES public.assets(id),
  category_id UUID REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  solucao TEXT,
  status ticket_status DEFAULT 'novo',
  prioridade priority_level DEFAULT 'media',
  impacto impact_level DEFAULT 'medio',
  urgencia urgency_level DEFAULT 'media',
  canal TEXT DEFAULT 'web',
  sla_atendimento_limite TIMESTAMPTZ,
  sla_solucao_limite TIMESTAMPTZ,
  data_primeiro_atendimento TIMESTAMPTZ,
  data_solucao TIMESTAMPTZ,
  data_fechamento TIMESTAMPTZ,
  tempo_gasto_horas NUMERIC DEFAULT 0,
  custo_pecas NUMERIC DEFAULT 0,
  avaliacao INTEGER CHECK (avaliacao BETWEEN 1 AND 5),
  comentario_avaliacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  comentario TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS (usando DROP IF EXISTS para evitar duplicação)
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  USING (id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admin can view all companies" ON public.companies;
CREATE POLICY "Admin can view all companies"
  ON public.companies FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin_provedor'));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view subcategories" ON public.subcategories;
CREATE POLICY "Anyone can view subcategories"
  ON public.subcategories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can view assets from their company" ON public.assets;
CREATE POLICY "Users can view assets from their company"
  ON public.assets FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico'))
  );

DROP POLICY IF EXISTS "Admins and technicians can manage assets" ON public.assets;
CREATE POLICY "Admins and technicians can manage assets"
  ON public.assets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico', 'gestor_cliente')));

DROP POLICY IF EXISTS "Users can view tickets from their company" ON public.tickets;
CREATE POLICY "Users can view tickets from their company"
  ON public.tickets FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico'))
  );

DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
CREATE POLICY "Users can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Technicians and admins can update tickets" ON public.tickets;
CREATE POLICY "Technicians and admins can update tickets"
  ON public.tickets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico', 'gestor_cliente')));

DROP POLICY IF EXISTS "Users can view comments from their tickets" ON public.ticket_comments;
CREATE POLICY "Users can view comments from their tickets"
  ON public.ticket_comments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.tickets 
      WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico'))
    )
  );

DROP POLICY IF EXISTS "Users can create comments" ON public.ticket_comments;
CREATE POLICY "Users can create comments"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view attachments from their tickets" ON public.ticket_attachments;
CREATE POLICY "Users can view attachments from their tickets"
  ON public.ticket_attachments FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.tickets 
      WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico'))
    )
  );

DROP POLICY IF EXISTS "Users can upload attachments" ON public.ticket_attachments;
CREATE POLICY "Users can upload attachments"
  ON public.ticket_attachments FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

-- Inserir categorias iniciais (apenas se não existirem)
INSERT INTO public.categories (nome, descricao, cor)
SELECT 'Hardware', 'Problemas relacionados a equipamentos físicos', '#EF4444'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE nome = 'Hardware');

INSERT INTO public.categories (nome, descricao, cor)
SELECT 'Software', 'Problemas com sistemas e aplicativos', '#3B82F6'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE nome = 'Software');

INSERT INTO public.categories (nome, descricao, cor)
SELECT 'Rede', 'Problemas de conectividade e infraestrutura', '#10B981'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE nome = 'Rede');

INSERT INTO public.categories (nome, descricao, cor)
SELECT 'Acesso', 'Problemas de autenticação e permissões', '#F59E0B'
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE nome = 'Acesso');

-- Inserir subcategorias (apenas se não existirem)
INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Hardware'), 'Desktop'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Desktop');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Hardware'), 'Notebook'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Notebook');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Hardware'), 'Impressora'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Impressora');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Hardware'), 'Monitor'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Monitor');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Software'), 'Office'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Office');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Software'), 'Antivírus'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Antivírus');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Software'), 'Sistema Operacional'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Sistema Operacional');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Rede'), 'Wi-Fi'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Wi-Fi');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Rede'), 'Cabeada'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Cabeada');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Acesso'), 'VPN'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'VPN');

INSERT INTO public.subcategories (category_id, nome)
SELECT (SELECT id FROM categories WHERE nome = 'Acesso'), 'Email'
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories WHERE nome = 'Email');