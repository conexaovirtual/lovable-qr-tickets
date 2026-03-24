import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, CheckCircle2, AlertTriangle, WifiOff, ExternalLink, KeyRound, RefreshCw, ScanSearch, ChevronDown, X, Monitor, Server, Printer, HardDrive } from 'lucide-react';
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

interface CreatedDevice {
  id: string;
  nome: string;
  companyId: string;
  companyName: string;
  tipo: string;
}

interface UnmatchedDevice {
  hostname: string;
  site: string;
  uid: string;
  deviceId: string;
}

interface CreatedCompany {
  id: string;
  nome: string;
}

interface FullSyncReport {
  total: number;
  detailsFetched: number;
  updated: number;
  created: number;
  deleted?: number;
  companiesCreated?: number;
  createdDevices?: CreatedDevice[];
  createdCompanies?: CreatedCompany[];
  deletedOrphans?: { nome: string; tipo: string }[];
  // Legacy fields
  noCompany?: number;
  unmatchedSites?: string[];
  unmatchedDevices?: UnmatchedDevice[];
}

type DattoOAuthCallbackPayload =
  | { type: 'datto-oauth-callback'; code: string; ts?: number }
  | { type: 'datto-oauth-callback-error'; error?: string; error_description?: string; ts?: number };

const CALLBACK_RESULT_KEY = 'datto_oauth_result';
const SYNC_REPORT_KEY = 'datto_last_sync_report';

const deviceTypeIcon = (tipo: string) => {
  switch (tipo) {
    case 'servidor': return Server;
    case 'impressora': return Printer;
    case 'switch': case 'roteador': return HardDrive;
    default: return Monitor;
  }
};

export function DattoMonitoringPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DattoStats>({ online: 0, alert: 0, offline: 0 });
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasDevices, setHasDevices] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<FullSyncReport | null>(() => {
    try {
      const saved = localStorage.getItem(SYNC_REPORT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [showCreated, setShowCreated] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
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
      localStorage.setItem(SYNC_REPORT_KEY, JSON.stringify(report));
      toast.success(`Varredura concluída: ${report.created} criados, ${report.updated} atualizados, ${report.deleted ?? 0} removidos`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro na varredura completa');
    } finally {
      setIsFullSyncing(false);
    }
  };

  const dismissReport = () => {
    setSyncReport(null);
    localStorage.removeItem(SYNC_REPORT_KEY);
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

        {/* Full sync report - PERSISTS */}
        {syncReport && !isFullSyncing && (
          <div className="space-y-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                ✅ Última varredura concluída
              </p>
              <Button variant="ghost" size="sm" onClick={dismissReport} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold">{syncReport.total}</p>
                <p className="text-muted-foreground">Total Datto</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold text-blue-600">{syncReport.updated}</p>
                <p className="text-muted-foreground">Atualizados</p>
              </div>
              <div
                className={`text-center p-2 rounded bg-background ${syncReport.created > 0 ? 'cursor-pointer hover:ring-2 ring-green-400 transition-all' : ''}`}
                onClick={() => syncReport.created > 0 && setShowCreated(!showCreated)}
              >
                <p className="text-lg font-bold text-green-600">{syncReport.created}</p>
                <p className="text-muted-foreground">Criados {syncReport.created > 0 && <ChevronDown className={`inline h-3 w-3 transition-transform ${showCreated ? 'rotate-180' : ''}`} />}</p>
              </div>
              <div
                className={`text-center p-2 rounded bg-background ${(syncReport.companiesCreated ?? 0) > 0 ? 'cursor-pointer hover:ring-2 ring-blue-400 transition-all' : ''}`}
                onClick={() => (syncReport.companiesCreated ?? 0) > 0 && setShowUnmatched(!showUnmatched)}
              >
                <p className="text-lg font-bold text-blue-600">{syncReport.companiesCreated ?? syncReport.noCompany ?? 0}</p>
                <p className="text-muted-foreground">Empresas criadas {(syncReport.companiesCreated ?? 0) > 0 && <ChevronDown className={`inline h-3 w-3 transition-transform ${showUnmatched ? 'rotate-180' : ''}`} />}</p>
              </div>
            </div>

            {/* Created devices detail */}
            {showCreated && syncReport.createdDevices && syncReport.createdDevices.length > 0 && (
              <div className="border-t border-green-200 dark:border-green-800 pt-2">
                <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                  Dispositivos criados ({syncReport.createdDevices.length})
                </p>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {syncReport.createdDevices.map((device, idx) => {
                      const DeviceIcon = deviceTypeIcon(device.tipo);
                      return (
                        <div
                          key={device.id || idx}
                          className="flex items-center gap-2 p-1.5 rounded text-xs bg-background hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => device.companyId && navigate(`/companies/${device.companyId}`)}
                        >
                          <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{device.nome}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{device.tipo}</Badge>
                          <span className="text-muted-foreground ml-auto truncate max-w-[150px]">→ {device.companyName}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Created companies detail */}
            {showUnmatched && syncReport.createdCompanies && syncReport.createdCompanies.length > 0 && (
              <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Empresas criadas automaticamente ({syncReport.createdCompanies.length})
                </p>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {syncReport.createdCompanies.map((company, idx) => (
                      <div
                        key={company.id || idx}
                        className="flex items-center gap-2 p-1.5 rounded text-xs bg-background hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/companies/${company.id}`)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="font-medium">{company.nome}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Legacy: Unmatched devices from old reports */}
            {showUnmatched && syncReport.unmatchedDevices && syncReport.unmatchedDevices.length > 0 && (
              <div className="border-t border-amber-200 dark:border-amber-800 pt-2">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
                  Dispositivos sem empresa ({syncReport.unmatchedDevices.length})
                </p>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {syncReport.unmatchedDevices.map((device, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 rounded text-xs bg-background"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="font-medium truncate">{device.hostname}</span>
                        <span className="text-muted-foreground ml-auto truncate max-w-[200px]">Site: {device.site}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
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
