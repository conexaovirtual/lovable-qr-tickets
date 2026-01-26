-- Criar enum para tipo de contrato
CREATE TYPE company_contract_type AS ENUM ('eventual', 'contrato_manutencao');

-- Adicionar coluna na tabela companies
ALTER TABLE companies 
ADD COLUMN tipo_contrato company_contract_type 
DEFAULT 'eventual' NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN companies.tipo_contrato IS 
  'Tipo de contrato: eventual (sob demanda) ou contrato_manutencao (visitas mensais)';