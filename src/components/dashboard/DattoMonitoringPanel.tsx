import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, CheckCircle2, AlertTriangle, WifiOff, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DattoStats {
  online: number;
  alert: number;
  offline: number;
}

interface RecentAlert {
  id: string;
  device_hostname: string;
  alert_type: string;
  alert_message: string;
  alert_priority: string;
  ticket_id: string | null;
  created_at: string;
}

export function DattoMonitoringPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DattoStats>({ online: 0, alert: 0, offline: 0 });
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDevices, setHasDevices] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [devicesResult, alertsResult] = await Promise.all([
      supabase
        .from('assets')
        .select('datto_status')
        .not('datto_device_id', 'is', null),
      supabase
        .from('datto_alerts_log')
        .select('id, device_hostname, alert_type, alert_message, alert_priority, ticket_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (devicesResult.data && devicesResult.data.length > 0) {
      setHasDevices(true);
      const counts: DattoStats = { online: 0, alert: 0, offline: 0 };
      devicesResult.data.forEach((d: any) => {
        const s = d.datto_status || 'online';
        if (s === 'alert') counts.alert++;
        else if (s === 'offline') counts.offline++;
        else counts.online++;
      });
      setStats(counts);
    }

    if (alertsResult.data) {
      setRecentAlerts(alertsResult.data as RecentAlert[]);
    }

    setLoading(false);
  };

  if (loading) {
    return <Skeleton className="h-48 mb-6" />;
  }

  if (!hasDevices && recentAlerts.length === 0) {
    return null;
  }

  const total = stats.online + stats.alert + stats.offline;

  return (
    <Card className="mb-6 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Monitoramento Datto RMM</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {total} dispositivos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{stats.online}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{stats.alert}</p>
              <p className="text-xs text-muted-foreground">Alertas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
            <WifiOff className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{stats.offline}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        {recentAlerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Alertas Recentes</p>
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{alert.device_hostname || 'Desconhecido'}</span>
                    <Badge
                      variant={alert.alert_priority === 'critical' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {alert.alert_priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {alert.alert_type}: {alert.alert_message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {alert.ticket_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/tickets/${alert.ticket_id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
