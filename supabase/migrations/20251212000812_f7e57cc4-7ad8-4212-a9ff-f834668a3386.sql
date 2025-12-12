-- Atualizar a VIEW companies_safe para incluir técnicos
CREATE OR REPLACE VIEW public.companies_safe AS
SELECT 
    id,
    nome_fantasia,
    razao_social,
    CASE
        WHEN is_admin(auth.uid()) OR can_view_financial_data(auth.uid()) THEN cnpj
        ELSE NULL::text
    END AS cnpj,
    CASE
        WHEN is_admin(auth.uid()) OR can_view_financial_data(auth.uid()) THEN email
        ELSE NULL::text
    END AS email,
    CASE
        WHEN is_admin(auth.uid()) OR can_view_financial_data(auth.uid()) THEN telefone
        ELSE NULL::text
    END AS telefone,
    endereco,
    sla_primeiro_atendimento_horas,
    sla_solucao_horas,
    status,
    created_at,
    updated_at
FROM companies c
WHERE status = true 
AND (
    (id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid())) 
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'tecnico'::user_role)
);