import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2 } from 'lucide-react';
import { PrintableReport } from './PrintableReport';

interface ReportPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportPrintDialog({ open, onOpenChange }: ReportPrintDialogProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [options, setOptions] = useState({
    includeAssets: true,
    includeTickets: true,
    includeStats: true,
  });
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadCompanies();
      // Set default dates (last 30 days)
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [open]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, nome_fantasia, status')
        .eq('status', true)
        .order('nome_fantasia');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error loading companies:', error);
      toast.error('Erro ao carregar empresas');
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);

      console.log('🔍 Iniciando geração de relatório...', {
        company: selectedCompany,
        period: { start: startDate, end: endDate },
        options
      });

      let query = supabase
        .from('company_statistics')
        .select('*')
        .order('nome_fantasia');

      if (selectedCompany !== 'all') {
        query = query.eq('company_id', selectedCompany);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('📊 Dados retornados:', data);
      console.log('📝 Total de empresas:', data?.length || 0);

      if (!data || data.length === 0) {
        toast.warning('Nenhum dado encontrado para os filtros selecionados');
        setLoading(false);
        return;
      }

      setReportData({
        companies: data,
        period: { start: startDate, end: endDate },
        options,
      });

      toast.success(`Relatório gerado com ${data.length} empresa(s)`);

      // Aumentar timeout para garantir renderização completa
      setTimeout(() => {
        console.log('🖨️ Abrindo janela de impressão...');
        window.print();
      }, 1000);
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerar Relatório para Impressão</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.nome_fantasia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label>Incluir no Relatório:</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assets"
                  checked={options.includeAssets}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeAssets: checked as boolean })
                  }
                />
                <label htmlFor="assets" className="text-sm cursor-pointer">
                  Lista de Ativos
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tickets"
                  checked={options.includeTickets}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeTickets: checked as boolean })
                  }
                />
                <label htmlFor="tickets" className="text-sm cursor-pointer">
                  Lista de Chamados
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stats"
                  checked={options.includeStats}
                  onCheckedChange={(checked) =>
                    setOptions({ ...options, includeStats: checked as boolean })
                  }
                />
                <label htmlFor="stats" className="text-sm cursor-pointer">
                  Estatísticas e Gráficos
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Gerar e Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {reportData && (
        <PrintableReport data={reportData} />
      )}
    </>
  );
}
