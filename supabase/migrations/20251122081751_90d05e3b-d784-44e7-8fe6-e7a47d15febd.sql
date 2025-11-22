-- ========================================
-- FASE 1: Adicionar campo "nome" aos Ativos
-- ========================================

-- Adicionar coluna nome (inicialmente nullable)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS nome TEXT;

-- Popular coluna nome com valores existentes (tag, modelo ou tipo + id)
UPDATE assets 
SET nome = COALESCE(
  NULLIF(tag_patrimonial, ''), 
  NULLIF(modelo, ''), 
  tipo || ' ' || SUBSTRING(id::text, 1, 8)
)
WHERE nome IS NULL;

-- Tornar coluna obrigatória
ALTER TABLE assets ALTER COLUMN nome SET NOT NULL;

-- Adicionar índices para busca otimizada
CREATE INDEX IF NOT EXISTS idx_assets_nome ON assets(nome);
CREATE INDEX IF NOT EXISTS idx_assets_company_nome ON assets(company_id, nome);

-- ========================================
-- FASE 2: Adicionar campo "canal" aos Tickets
-- ========================================

-- Criar ENUM para canal de atendimento (se não existir)
DO $$ BEGIN
  CREATE TYPE canal_atendimento AS ENUM ('whatsapp', 'ligacao', 'visita_tecnica', 'email', 'web');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar coluna canal aos tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS canal canal_atendimento DEFAULT 'web';

-- Popular tickets existentes com valor padrão
UPDATE tickets SET canal = 'web' WHERE canal IS NULL;

-- ========================================
-- FASE 3: Migração de Daily Service Records para Tickets
-- ========================================

-- Criar função de migração
CREATE OR REPLACE FUNCTION migrate_daily_records_to_tickets()
RETURNS TABLE(migrated_count INT, error_count INT) AS $$
DECLARE
  record_row RECORD;
  new_ticket_id UUID;
  migrated INT := 0;
  errors INT := 0;
BEGIN
  -- Iterar sobre todos os daily_service_records que não têm ticket vinculado
  FOR record_row IN 
    SELECT * FROM daily_service_records
    WHERE ticket_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM tickets WHERE tickets.id = daily_service_records.ticket_id
    )
  LOOP
    BEGIN
      -- Inserir como novo ticket
      INSERT INTO tickets (
        company_id,
        solicitante_id,
        tecnico_id,
        asset_id,
        titulo,
        descricao,
        solucao,
        canal,
        status,
        impacto,
        urgencia,
        created_at
      ) VALUES (
        record_row.company_id,
        record_row.tecnico_id, -- técnico vira solicitante inicial
        record_row.tecnico_id,
        record_row.asset_id,
        record_row.titulo,
        record_row.descricao,
        record_row.solucao,
        record_row.canal::text::canal_atendimento,
        CASE record_row.status
          WHEN 'concluido' THEN 'resolvido'::ticket_status
          WHEN 'em_andamento' THEN 'em_atendimento'::ticket_status
          ELSE 'novo'::ticket_status
        END,
        'medio'::impact_level,
        'media'::urgency_level,
        record_row.created_at
      ) RETURNING id INTO new_ticket_id;
      
      -- Atualizar daily_service_record com referência ao ticket
      UPDATE daily_service_records 
      SET ticket_id = new_ticket_id 
      WHERE id = record_row.id;
      
      -- Adicionar comentário com dados adicionais
      INSERT INTO ticket_comments (
        ticket_id,
        user_id,
        comentario,
        is_internal
      ) VALUES (
        new_ticket_id,
        record_row.tecnico_id,
        'Migrado de atendimento diário. Horário: ' || 
        record_row.hora_inicio || ' - ' || COALESCE(record_row.hora_fim, 'em andamento') ||
        '. Observações: ' || COALESCE(record_row.observacoes, 'N/A'),
        true
      );
      
      migrated := migrated + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        errors := errors + 1;
        RAISE NOTICE 'Erro ao migrar registro %: %', record_row.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated, errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Executar migração (comentar depois da primeira execução)
-- SELECT * FROM migrate_daily_records_to_tickets();

-- ========================================
-- FASE 4: Comentários e Observações
-- ========================================

-- Adicionar comentário para facilitar rollback se necessário
COMMENT ON COLUMN assets.nome IS 'Nome identificador do ativo - adicionado em 2025-11-22 para unificação de ativos';
COMMENT ON COLUMN tickets.canal IS 'Canal de atendimento do chamado - adicionado em 2025-11-22 para unificação com daily_service_records';
COMMENT ON FUNCTION migrate_daily_records_to_tickets() IS 'Migra registros diários para tickets - executado em 2025-11-22';