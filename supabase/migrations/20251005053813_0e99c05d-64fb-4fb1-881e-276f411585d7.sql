-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin_provedor', 'tecnico', 'gestor_cliente', 'solicitante');
CREATE TYPE asset_type AS ENUM ('desktop', 'notebook', 'impressora', 'monitor', 'roteador', 'switch', 'servidor', 'periferico', 'outro');
CREATE TYPE asset_status AS ENUM ('em_uso', 'estoque', 'manutencao', 'baixado');
CREATE TYPE ticket_status AS ENUM ('novo', 'triagem', 'em_atendimento', 'aguardando_usuario', 'aguardando_peca', 'resolvido', 'validando_cliente', 'fechado');
CREATE TYPE priority_level AS ENUM ('critica', 'alta', 'media', 'baixa');
CREATE TYPE impact_level AS ENUM ('alto', 'medio', 'baixo');
CREATE TYPE urgency_level AS ENUM ('alta', 'media', 'baixa');

-- Empresas (Companies)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  status BOOLEAN DEFAULT true,
  sla_primeiro_atendimento_horas INTEGER DEFAULT 4,
  sla_solucao_horas INTEGER DEFAULT 16,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfis de usuários (User Profiles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  role user_role NOT NULL DEFAULT 'solicitante',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subcategorias
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativos (Assets)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  tipo asset_type NOT NULL,
  fabricante TEXT,
  modelo TEXT,
  numero_serie TEXT,
  tag_patrimonial TEXT,
  setor TEXT,
  local TEXT,
  estado asset_status DEFAULT 'em_uso',
  data_compra DATE,
  garantia_fim DATE,
  sistema_operacional TEXT,
  configuracoes JSONB,
  qrcode_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chamados (Tickets)
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero SERIAL UNIQUE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  solicitante_id UUID REFERENCES profiles(id) NOT NULL,
  tecnico_id UUID REFERENCES profiles(id),
  asset_id UUID REFERENCES assets(id),
  category_id UUID REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  impacto impact_level DEFAULT 'medio',
  urgencia urgency_level DEFAULT 'media',
  prioridade priority_level DEFAULT 'media',
  status ticket_status DEFAULT 'novo',
  sla_atendimento_limite TIMESTAMPTZ,
  sla_solucao_limite TIMESTAMPTZ,
  canal TEXT DEFAULT 'web',
  solucao TEXT,
  tempo_gasto_horas DECIMAL(10,2) DEFAULT 0,
  custo_pecas DECIMAL(10,2) DEFAULT 0,
  avaliacao INTEGER CHECK (avaliacao >= 1 AND avaliacao <= 5),
  comentario_avaliacao TEXT,
  data_primeiro_atendimento TIMESTAMPTZ,
  data_solucao TIMESTAMPTZ,
  data_fechamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários nos chamados
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  comentario TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anexos
CREATE TABLE ticket_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_assets_company ON assets(company_id);
CREATE INDEX idx_assets_qrcode ON assets(qrcode_token);
CREATE INDEX idx_tickets_company ON tickets(company_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_solicitante ON tickets(solicitante_id);
CREATE INDEX idx_tickets_tecnico ON tickets(tecnico_id);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate priority based on impact and urgency
CREATE OR REPLACE FUNCTION calculate_priority(p_impacto impact_level, p_urgencia urgency_level)
RETURNS priority_level AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate priority
CREATE OR REPLACE FUNCTION set_ticket_priority()
RETURNS TRIGGER AS $$
BEGIN
  NEW.prioridade := calculate_priority(NEW.impacto, NEW.urgencia);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_ticket_priority BEFORE INSERT OR UPDATE OF impacto, urgencia ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_priority();

-- Function to calculate SLA deadlines
CREATE OR REPLACE FUNCTION set_ticket_sla()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_ticket_sla BEFORE INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_sla();

-- Trigger to set first response time
CREATE OR REPLACE FUNCTION set_first_response_time()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_ticket_times BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_first_response_time();

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for companies (admins see all, others see their company)
CREATE POLICY "Admin can view all companies" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin_provedor'
    )
  );

CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for categories (public read)
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view subcategories" ON subcategories FOR SELECT USING (true);

-- RLS Policies for assets
CREATE POLICY "Users can view assets from their company" ON assets
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin_provedor', 'tecnico')
    )
  );

CREATE POLICY "Admins and technicians can manage assets" ON assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin_provedor', 'tecnico', 'gestor_cliente')
    )
  );

-- RLS Policies for tickets
CREATE POLICY "Users can view tickets from their company" ON tickets
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin_provedor', 'tecnico')
    )
  );

CREATE POLICY "Users can create tickets" ON tickets
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Technicians and admins can update tickets" ON tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin_provedor', 'tecnico', 'gestor_cliente')
    )
  );

-- RLS Policies for ticket comments
CREATE POLICY "Users can view comments from their tickets" ON ticket_comments
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM tickets WHERE 
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico'))
    )
  );

CREATE POLICY "Users can create comments" ON ticket_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments from their tickets" ON ticket_attachments
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM tickets WHERE 
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin_provedor', 'tecnico'))
    )
  );

CREATE POLICY "Users can upload attachments" ON ticket_attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
  );

-- Insert default categories
INSERT INTO categories (nome, descricao, cor) VALUES
  ('Hardware', 'Problemas com equipamentos físicos', '#EF4444'),
  ('Software', 'Problemas com aplicativos e sistemas', '#3B82F6'),
  ('Rede', 'Problemas de conectividade', '#10B981'),
  ('Acesso', 'Problemas de login e permissões', '#F59E0B');

-- Insert default subcategories
INSERT INTO subcategories (category_id, nome) 
SELECT id, 'Notebook' FROM categories WHERE nome = 'Hardware'
UNION ALL
SELECT id, 'Desktop' FROM categories WHERE nome = 'Hardware'
UNION ALL
SELECT id, 'Impressora' FROM categories WHERE nome = 'Hardware'
UNION ALL
SELECT id, 'Monitor' FROM categories WHERE nome = 'Hardware'
UNION ALL
SELECT id, 'Office' FROM categories WHERE nome = 'Software'
UNION ALL
SELECT id, 'Antivírus' FROM categories WHERE nome = 'Software'
UNION ALL
SELECT id, 'Sistema Operacional' FROM categories WHERE nome = 'Software'
UNION ALL
SELECT id, 'Wi-Fi' FROM categories WHERE nome = 'Rede'
UNION ALL
SELECT id, 'Cabeada' FROM categories WHERE nome = 'Rede'
UNION ALL
SELECT id, 'VPN' FROM categories WHERE nome = 'Acesso'
UNION ALL
SELECT id, 'Email' FROM categories WHERE nome = 'Acesso';

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    'solicitante'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();