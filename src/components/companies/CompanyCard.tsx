import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Mail, Phone, MapPin, Clock, Eye, FileText, Calendar, MessageCircle, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface CompanyCardProps {
  company: any;
  onEdit: (company: any) => void;
  onUpdate: () => void;
  canDelete?: boolean;
}

export const CompanyCard = memo(({ company, onEdit, onUpdate, canDelete }: CompanyCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Get ticket IDs for this company to clean up comments and attachments
      const { data: tickets } = await supabase.from('tickets').select('id').eq('company_id', company.id);
      const ticketIds = tickets?.map(t => t.id) || [];
      
      if (ticketIds.length > 0) {
        await supabase.from('ticket_comments').delete().in('ticket_id', ticketIds);
        await supabase.from('ticket_attachments').delete().in('ticket_id', ticketIds);
      }

      // Get asset IDs for changelog cleanup
      const { data: assets } = await supabase.from('assets').select('id').eq('company_id', company.id);
      const assetIds = assets?.map(a => a.id) || [];

      if (assetIds.length > 0) {
        await supabase.from('asset_changelog').delete().in('asset_id', assetIds);
        await supabase.from('asset_relationships').delete().in('parent_asset_id', assetIds);
        await supabase.from('asset_relationships').delete().in('child_asset_id', assetIds);
        await supabase.from('ai_predictions').delete().in('asset_id', assetIds);
        await supabase.from('datto_alerts_log').delete().in('asset_id', assetIds);
      }

      // Get service order IDs
      const { data: serviceOrders } = await supabase.from('service_orders').select('id').eq('company_id', company.id);
      const soIds = serviceOrders?.map(s => s.id) || [];

      if (soIds.length > 0) {
        await supabase.from('service_order_history').delete().in('service_order_id', soIds);
        await supabase.from('contract_hour_entries').delete().in('service_order_id', soIds);
      }

      // Get contract IDs
      const { data: contracts } = await supabase.from('contracts').select('id').eq('company_id', company.id);
      const contractIds = contracts?.map(c => c.id) || [];

      if (contractIds.length > 0) {
        await supabase.from('contract_hour_entries').delete().in('contract_id', contractIds);
      }

      // Remove all related records in order
      await supabase.from('whatsapp_contacts').delete().eq('company_id', company.id);
      await supabase.from('visit_schedules').delete().eq('company_id', company.id);
      await supabase.from('daily_service_records').delete().eq('company_id', company.id);
      await supabase.from('tickets').delete().eq('company_id', company.id);
      await supabase.from('service_orders').delete().eq('company_id', company.id);
      await supabase.from('assets').delete().eq('company_id', company.id);
      await supabase.from('contracts').delete().eq('company_id', company.id);
      await supabase.from('cost_centers').delete().eq('company_id', company.id);
      await supabase.from('projects').delete().eq('company_id', company.id);

      const { error } = await supabase.from('companies').delete().eq('id', company.id);
      if (error) {
        toast({ title: 'Erro ao excluir empresa', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Empresa excluída com sucesso' });
        onUpdate();
      }
    } catch (err: any) {
      toast({ title: 'Erro ao excluir empresa', description: err.message, variant: 'destructive' });
    }
    setDeleting(false);
    setDeleteOpen(false);
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{company.nome_fantasia}</CardTitle>
              {company.razao_social && (
                <p className="text-sm text-muted-foreground truncate">{company.razao_social}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge 
                variant={company.tipo_contrato === 'contrato_manutencao' ? 'default' : 'outline'}
                className={company.tipo_contrato === 'contrato_manutencao' ? 'bg-primary' : ''}
              >
                {company.tipo_contrato === 'contrato_manutencao' ? (
                  <><Calendar className="h-3 w-3 mr-1" />Contrato</>
                ) : (
                  <><FileText className="h-3 w-3 mr-1" />Eventual</>
                )}
              </Badge>
              <Badge variant={company.status ? 'secondary' : 'outline'} className="text-xs">
                {company.status ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {company.cnpj && (
            <div className="text-sm">
              <span className="font-medium">CNPJ:</span> {company.cnpj}
            </div>
          )}
          
          {company.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{company.email}</span>
            </div>
          )}
          
          {company.telefone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{company.telefone}</span>
            </div>
          )}

          {company.whatsapp && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              <span>{company.whatsapp}</span>
            </div>
          )}
          
          {company.endereco && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{company.endereco}</span>
            </div>
          )}

          {(company.sla_primeiro_atendimento_horas !== null && company.sla_solucao_horas !== null) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
              <Clock className="h-4 w-4" />
              <span>
                SLA: {company.sla_primeiro_atendimento_horas}h / {company.sla_solucao_horas}h
              </span>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => navigate(`/companies/${company.id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Detalhes
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onEdit(company)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            {canDelete && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{company.nome_fantasia}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});