-- Primeiro, limpar as duplicatas existentes da "Nova Era"
-- Mantém apenas o registro mais antigo
DELETE FROM companies 
WHERE nome_fantasia = 'Nova Era' 
  AND id NOT IN (
    SELECT id 
    FROM companies 
    WHERE nome_fantasia = 'Nova Era'
    ORDER BY created_at ASC
    LIMIT 1
  );

-- Adicionar constraint UNIQUE no CNPJ (quando preenchido)
-- Usa índice parcial para permitir NULL mas não permitir duplicatas
CREATE UNIQUE INDEX companies_cnpj_unique_idx 
ON companies (cnpj) 
WHERE cnpj IS NOT NULL AND cnpj != '';

-- Adicionar constraint UNIQUE no nome_fantasia
-- Previne cadastro de empresas com mesmo nome
ALTER TABLE companies 
ADD CONSTRAINT companies_nome_fantasia_unique 
UNIQUE (nome_fantasia);