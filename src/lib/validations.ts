import { z } from 'zod';

export const ticketSchema = z.object({
  titulo: z.string()
    .min(5, 'O título deve ter no mínimo 5 caracteres')
    .max(100, 'O título deve ter no máximo 100 caracteres'),
  descricao: z.string()
    .min(10, 'A descrição deve ter no mínimo 10 caracteres')
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres'),
  category_id: z.string().min(1, 'Selecione uma categoria'),
  subcategory_id: z.string().optional(),
  asset_id: z.string().optional(),
  impacto: z.enum(['baixo', 'medio', 'alto']),
  urgencia: z.enum(['baixa', 'media', 'alta']),
});

export const assetSchema = z.object({
  tipo: z.string().min(1, 'Selecione o tipo'),
  fabricante: z.string().max(100, 'Fabricante muito longo').optional(),
  modelo: z.string().max(100, 'Modelo muito longo').optional(),
  numero_serie: z.string().max(100, 'Número de série muito longo').optional(),
  tag_patrimonial: z.string().max(50, 'Tag muito longa').optional(),
  local: z.string().max(100, 'Local muito longo').optional(),
  setor: z.string().max(100, 'Setor muito longo').optional(),
  sistema_operacional: z.string().max(100, 'SO muito longo').optional(),
  estado: z.enum(['em_uso', 'estoque', 'manutencao', 'baixado']),
  data_compra: z.string().optional(),
  garantia_fim: z.string().optional(),
  observacoes: z.string().max(500, 'Observações muito longas').optional(),
});

export const commentSchema = z.object({
  comentario: z.string()
    .min(1, 'O comentário não pode estar vazio')
    .max(1000, 'O comentário deve ter no máximo 1000 caracteres'),
  is_internal: z.boolean().optional(),
});

export type TicketFormData = z.infer<typeof ticketSchema>;
export type AssetFormData = z.infer<typeof assetSchema>;
export type CommentFormData = z.infer<typeof commentSchema>;
