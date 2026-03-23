import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Activity, CheckCircle2, AlertTriangle, WifiOff, ExternalLink, KeyRound, RefreshCw, ScanSearch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

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

interface FullSyncReport {
  total: number;
  detailsFetched: number;
  updated: number;
  created: number;
  noCompany: number;
  unmatchedSites: string[];
}

type DattoOAuthCallbackPayload =
  | { type: 'datto-oauth-callback'; code: string; ts?: number }
  | { type: 'datto-oauth-callback-error'; error?: string; error_description?: string; ts?: number };

const CALLBACK_RESULT_KEY = 'datto_oauth_result';

export function DattoMonitoringPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DattoStats>({ online: 0, alert: 0, offline: 0 });
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDevices, setHasDevices] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<FullSyncReport | null>(null);
  const processedOAuthResultRef = useRef<string | null>(null);

  const parseOAuthPayload = (value: string): DattoOAuthCallbackPayload | null => {
    try {
      const parsed = JSON.parse(value) as DattoOAuthCallbackPayload;
      if (parsed?.type === 'datto-oauth-callback' || parsed?.type === 'datto-oauth-callback-error') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const consumeOAuthPayload = async (payload: DattoOAuthCallbackPayload) => {
    const payloadValue = payload.type === 'datto-oauth-callback' ? payload.code : payload.error ?? payload.error_description ?? '';
    const payloadId = `${payload.type}:${payloadValue}:${payload.ts ?? ''}`;
    if (processedOAuthResultRef.current === payloadId) return;
    processedOAuthResultRef.current = payloadId;
    localStorage.removeItem(CALLBACK_RESULT_KEY);

    if (payload.type === 'datto-oauth-callback' && payload.code) {
      await exchangeCode(payload.code);
      return;
    }

    if (payload.type === 'datto-oauth-callback-error') {
      toast.error(payload.error_description || payload.error || 'Erro na autorização do Datto');
      return;
    }

    toast.error('Erro na autorização do Datto');
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as DattoOAuthCallbackPayload;
      if (payload?.type !== 'datto-oauth-callback' && payload?.type !== 'datto-oauth-callback-error') return;
      await consumeOAuthPayload(payload);
    };

    const handleStorage = async (event: StorageEvent) => {
      if (event.key !== CALLBACK_RESULT_KEY || !event.newValue) return;
      const payload = parseOAuthPayload(event.newValue);
      if (!payload) return;
      await consumeOAuthPayload(payload);
    };

    const pendingPayload = localStorage.getItem(CALLBACK_RESULT_KEY);
    if (pendingPayload) {
      const payload = parseOAuthPayload(pendingPayload);
      if (payload) {
        void consumeOAuthPayload(payload);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [devicesResult, alertsResult] = await Promise.all([
      supabase.from('assets').select('datto_status').not('datto_device_id', 'is', null),
      supabase.from('datto_alerts_log')
        .select('id, device_hostname, alert_type, alert_message, alert_priority, ticket_id, created_at')
        .order('created_at', { ascending: false }).limit(5),
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
    if (alertsResult.data) setRecentAlerts(alertsResult.data as RecentAlert[]);
    setLoading(false);
  };

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    processedOAuthResultRef.current = null;
    localStorage.removeItem(CALLBACK_RESULT_KEY);

    try {
      const redirectUri = `${window.location.origin}/datto-callback`;
      const { data, error } = await supabase.functions.invoke('datto-oauth-start', { body: { redirect_uri: redirectUri } });
      if (error) throw new Error(error.message || 'Erro ao iniciar autorização');
      if (!data?.authorize_url) throw new Error('URL de autorização não retornada');
      const popup = window.open(data.authorize_url, 'datto-oauth', 'width=600,height=700,menubar=no,toolbar=no,location=yes');
      if (!popup) toast.error('Popup bloqueado! Permita popups para este site.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao autorizar Datto');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const exchangeCode = async (code: string) => {
    try {
      const redirectUri = `${window.location.origin}/datto-callback`;
      const { data, error } = await supabase.functions.invoke('datto-oauth-callback', { body: { code, redirect_uri: redirectUri } });
      if (error) throw new Error(error.message || 'Erro ao trocar código');
      if (!data?.success) throw new Error('Falha ao salvar token');
      toast.success('Datto RMM autorizado com sucesso!');
      handleSync();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao completar autorização');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('datto-check-offline');
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro na sincronização');
      toast.success(`Sincronizado: ${data.sync.dattoDevices} dispositivos`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    setIsFullSyncing(true);
    setSyncReport(null);
    try {
      toast.info('Varredura completa iniciada. Isso pode levar alguns minutos...');
      const { data, error } = await supabase.functions.invoke('datto-full-sync');
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro na varredura');
      const report = data.report as FullSyncReport;
      setSyncReport(report);
      toast.success(`Varredura concluída: ${report.created} criados, ${report.updated} atualizados`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro na varredura completa');
    } finally {
      setIsFullSyncing(false);
    }
  };

  if (loading) return <Skeleton className="h-48 mb-6" />;

  const total = stats.online + stats.alert + stats.offline;

  return (
    <Card className="mb-6 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Monitoramento Datto RMM</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleAuthorize} disabled={isAuthorizing} className="text-xs">
              <KeyRound className="h-3 w-3 mr-1" />
              {isAuthorizing ? 'Autorizando...' : 'Autorizar'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleFullSync}
              disabled={isFullSyncing}
              className="text-xs bg-blue-600 hover:bg-blue-700"
            >
              <ScanSearch className={`h-3 w-3 mr-1 ${isFullSyncing ? 'animate-pulse' : ''}`} />
              {isFullSyncing ? 'Varrendo...' : 'Varredura Completa'}
            </Button>
            {total > 0 && (
              <Badge variant="outline" className="text-xs">{total} dispositivos</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Full sync progress */}
        {isFullSyncing && (
          <div className="space-y-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              🔍 Varredura completa em andamento...
            </p>
            <p className="text-xs text-muted-foreground">
              Buscando dispositivos, coletando hardware e cadastrando ativos. Isso pode levar alguns minutos.
            </p>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {/* Full sync report */}
        {syncReport && !isFullSyncing && (
          <div className="space-y-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              ✅ Varredura concluída
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold">{syncReport.total}</p>
                <p className="text-muted-foreground">Total Datto</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold text-blue-600">{syncReport.updated}</p>
                <p className="text-muted-foreground">Atualizados</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold text-green-600">{syncReport.created}</p>
                <p className="text-muted-foreground">Criados</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold text-amber-600">{syncReport.noCompany}</p>
                <p className="text-muted-foreground">Sem empresa</p>
              </div>
            </div>
            {syncReport.unmatchedSites.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                <p className="font-medium">Sites sem correspondência:</p>
                <p className="truncate">{syncReport.unmatchedSites.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {total > 0 ? (
          <>
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

            {recentAlerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Alertas Recentes</p>
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{alert.device_hostname || 'Desconhecido'}</span>
                        <Badge variant={alert.alert_priority === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
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
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/tickets/${alert.ticket_id}`)}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Autorizar" para conectar ao Datto RMM e depois "Sincronizar".
          </p>
        )}
      </CardContent>
    </Card>
  );
}
