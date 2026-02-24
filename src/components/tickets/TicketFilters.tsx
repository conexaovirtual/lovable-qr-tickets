import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface TicketFiltersProps {
  filters: {
    status: string;
    prioridade: string;
    categoria: string;
    canal: string;
    viaQRCode: string;
  };
  setFilters: (filters: any) => void;
}

export function TicketFilters({ filters, setFilters }: TicketFiltersProps) {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const handleFilterChange = useDebouncedCallback((field: string, value: string) => {
    setFilters({ ...filters, [field]: value === 'all' ? '' : value });
  }, 300);

  const clearFilters = () => {
    setFilters({ status: '', prioridade: '', categoria: '', canal: '', viaQRCode: '' });
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="novo">Novo</SelectItem>
            <SelectItem value="triagem">Triagem</SelectItem>
            <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
            <SelectItem value="aguardando_usuario">Aguardando Usuário</SelectItem>
            <SelectItem value="aguardando_peca">Aguardando Peça</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
            <SelectItem value="validando_cliente">Validando Cliente</SelectItem>
            <SelectItem value="fechado">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Prioridade</Label>
        <Select value={filters.prioridade || 'all'} onValueChange={(value) => handleFilterChange('prioridade', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={filters.categoria || 'all'} onValueChange={(value) => handleFilterChange('categoria', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Canal</Label>
        <Select value={filters.canal || 'all'} onValueChange={(value) => handleFilterChange('canal', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="web">Portal Web</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="ligacao">Telefone</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="visita_tecnica">Visita Técnica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Origem</Label>
        <Select value={filters.viaQRCode || 'all'} onValueChange={(value) => handleFilterChange('viaQRCode', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="true">Via QR Code</SelectItem>
            <SelectItem value="false">Via Sistema</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" onClick={clearFilters} className="w-full">
        Limpar Filtros
      </Button>
    </div>
  );
}
