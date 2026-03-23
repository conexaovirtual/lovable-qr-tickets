UPDATE tickets 
SET status = 'resolvido', 
    solucao = 'Chamado gerado automaticamente por alerta de desligamento inesperado (Datto RMM). Evento de queda de energia ou reinício abrupto — não requer intervenção técnica. Filtro de alertas já aplicado para evitar futuros chamados deste tipo.',
    updated_at = now()
WHERE id IN (
  '45f68d9c-f355-4adb-8d72-97bc120e86fb',
  'a2d6bdd5-1209-4033-83f7-78e1413a0af6',
  '5e1426db-b399-446c-b08e-7487e7355642',
  '97137a19-253b-49ca-b8a5-ed9afb40b20e',
  '7980de22-3538-437d-b922-3e14d8d6c152',
  '570f475b-ab0c-4fc9-83b1-0d6abee2743b'
) AND status NOT IN ('resolvido', 'fechado');