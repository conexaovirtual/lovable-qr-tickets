import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Mail, Phone, MapPin, Clock, Eye, FileText, Calendar, MessageCircle } from 'lucide-react';

interface CompanyCardProps {
  company: any;
  onEdit: (company: any) => void;
  onUpdate: () => void;
}

export const CompanyCard = memo(({ company, onEdit }: CompanyCardProps) => {
  const navigate = useNavigate();

  return (
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
        </div>
      </CardContent>
    </Card>
  );
});
