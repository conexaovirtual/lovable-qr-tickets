import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Users, 
  Building2, 
  CheckCircle2,
  Eye,
  Loader2,
  Brain
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Alert {
  id: string;
  tipo: string;
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  dados: any;
  acao_sugerida: string;
  lido: boolean;
  resolvido: boolean;
  created_at: string;
}

export function SmartAlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_alerts')
        .select('*')
        .eq('resolvido', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAlerts((data || []) as Alert[]);
    } catch (err) {
      console.error('Erro ao carregar alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAlerts = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-smart-alerts', {
        body: {}
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${data.alertas?.length || 0} alertas analisados`);
      loadAlerts();
    } catch (err: any) {
      toast.error('Erro ao gerar alertas');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await supabase
        .from('ai_alerts')
        .update({ lido: true })
        .eq('id', alertId);

      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, lido: true } : a
      ));
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await supabase
        .from('ai_alerts')
        .update({ resolvido: true })
        .eq('id', alertId);

      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alerta resolvido');
    } catch (err) {
      console.error('Erro ao resolver alerta:', err);
    }
  };

  const getAlertIcon = (tipo: string) => {
    switch (tipo) {
      case 'sla_risco': return <Clock className="h-4 w-4" />;
      case 'tecnico_sobrecarga': return <Users className="h-4 w-4" />;
      case 'empresa_atencao': return <Building2 className="h-4 w-4" />;
      case 'padrao_anormal': return <AlertTriangle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severidade: string) => {
    switch (severidade) {
      case 'alta': return 'destructive';
      case 'media': return 'warning';
      case 'baixa': return 'secondary';
      default: return 'outline';
    }
  };

  const unreadCount = alerts.filter(a => !a.lido).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Alertas Inteligentes
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] px-1">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <Button
            onClick={handleGenerateAlerts}
            variant="outline"
            size="sm"
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum alerta ativo</p>
            <Button
              onClick={handleGenerateAlerts}
              variant="link"
              size="sm"
              className="mt-2"
            >
              Analisar agora
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border transition-colors ${
                  !alert.lido 
                    ? 'bg-muted/50 border-primary/30' 
                    : 'bg-background'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 ${
                    alert.severidade === 'alta' ? 'text-destructive' : 
                    alert.severidade === 'media' ? 'text-yellow-600' : 
                    'text-muted-foreground'
                  }`}>
                    {getAlertIcon(alert.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {alert.titulo}
                      </span>
                      <Badge variant={getSeverityColor(alert.severidade) as any} className="text-xs">
                        {alert.severidade}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {alert.descricao}
                    </p>
                    {alert.acao_sugerida && (
                      <p className="text-xs text-primary mt-1">
                        💡 {alert.acao_sugerida}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 mt-2 justify-end">
                  {!alert.lido && (
                    <Button
                      onClick={() => handleMarkAsRead(alert.id)}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Marcar lido
                    </Button>
                  )}
                  <Button
                    onClick={() => handleResolve(alert.id)}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-green-600"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
