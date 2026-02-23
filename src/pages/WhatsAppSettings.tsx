import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Wifi, WifiOff, Settings, Send, RefreshCw, Link2, Loader2, CheckCircle, XCircle, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function WhatsAppSettings() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [instanceName, setInstanceName] = useState('');
  const [autoCreateTicket, setAutoCreateTicket] = useState(true);
  const [autoNotify, setAutoNotify] = useState(true);
  const [greeting, setGreeting] = useState('Olá! Seu chamado foi recebido. Em breve um técnico irá atendê-lo.');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Mensagem de teste do Help Desk Conexão Virtual');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // Load config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.roles?.includes('admin_provedor'),
  });

  // Load instances from Evolution API
  const { data: instances, isLoading: instancesLoading } = useQuery({
    queryKey: ['evolution-instances'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { action: 'fetch_instances' },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.roles?.includes('admin_provedor'),
    retry: 1,
  });

  // Load contacts
  const { data: contacts } = useQuery({
    queryKey: ['whatsapp-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*, company:companies(nome_fantasia)')
        .order('last_message_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.roles?.includes('admin_provedor'),
  });

  // Load companies for contact mapping
  const { data: companies } = useQuery({
    queryKey: ['companies-for-whatsapp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, nome_fantasia')
        .eq('status', true)
        .order('nome_fantasia');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.roles?.includes('admin_provedor'),
  });

  useEffect(() => {
    if (config) {
      setInstanceName(config.instance_name || '');
      setAutoCreateTicket(config.auto_create_ticket ?? true);
      setAutoNotify(config.auto_notify_updates ?? true);
      setGreeting(config.default_greeting || '');
    }
  }, [config]);

  useEffect(() => {
    if (!authLoading && profile && !profile.roles?.includes('admin_provedor')) {
      navigate('/dashboard');
    }
  }, [profile, authLoading, navigate]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const payload = {
        instance_name: instanceName,
        auto_create_ticket: autoCreateTicket,
        auto_notify_updates: autoNotify,
        default_greeting: greeting,
      };

      if (config?.id) {
        const { error } = await supabase
          .from('whatsapp_config')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_config')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      toast({ title: 'Configuração salva com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const checkConnection = async () => {
    if (!instanceName) {
      toast({ title: 'Informe o nome da instância', variant: 'destructive' });
      return;
    }
    setCheckingStatus(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { action: 'check_status', instance_name: instanceName },
      });
      if (error) throw error;
      const state = result?.instance?.state || result?.state || 'unknown';
      setConnectionStatus(state);
      
      // Update config status
      if (config?.id) {
        await supabase.from('whatsapp_config').update({ status: state }).eq('id', config.id);
      }
    } catch (err) {
      setConnectionStatus('error');
    } finally {
      setCheckingStatus(false);
    }
  };

  const configureWebhook = async () => {
    if (!instanceName) return;
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      const { data: result, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          action: 'set_webhook',
          instance_name: instanceName,
          webhook_url: webhookUrl,
        },
      });
      if (error) throw error;
      
      if (config?.id) {
        await supabase.from('whatsapp_config').update({ webhook_configured: true }).eq('id', config.id);
        queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      }
      
      toast({ title: 'Webhook configurado com sucesso!', description: `URL: ${webhookUrl}` });
    } catch (err: any) {
      toast({ title: 'Erro ao configurar webhook', description: err.message, variant: 'destructive' });
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone || !instanceName) {
      toast({ title: 'Preencha o telefone e configure a instância', variant: 'destructive' });
      return;
    }
    try {
      const { data: result, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          action: 'send_text',
          phone: testPhone,
          text: testMessage,
          instance_name: instanceName,
        },
      });
      if (error) throw error;
      toast({ title: 'Mensagem enviada!', description: `Para: ${testPhone}` });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    }
  };

  const updateContactCompany = async (contactId: string, companyId: string | null) => {
    const { error } = await supabase
      .from('whatsapp_contacts')
      .update({ company_id: companyId })
      .eq('id', contactId);
    if (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      toast({ title: 'Contato atualizado' });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
    }
  };

  if (authLoading || configLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-500" />
            Integração WhatsApp
          </h1>
          <p className="text-muted-foreground">Configure a integração com WhatsApp via Evolution API</p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {connectionStatus === 'open' ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              Status da Conexão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Nome da Instância</Label>
                {instances && Array.isArray(instances) && instances.length > 0 ? (
                  <Select value={instanceName} onValueChange={setInstanceName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((inst: any) => (
                        <SelectItem key={inst.instance?.instanceName || inst.instanceName} value={inst.instance?.instanceName || inst.instanceName}>
                          {inst.instance?.instanceName || inst.instanceName}
                          {' '}
                          <Badge variant={inst.instance?.state === 'open' ? 'default' : 'secondary'} className="ml-2">
                            {inst.instance?.state || 'unknown'}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="Nome da instância na Evolution API"
                  />
                )}
              </div>
              <div className="pt-6">
                <Button onClick={checkConnection} disabled={checkingStatus} variant="outline">
                  {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Verificar</span>
                </Button>
              </div>
            </div>
            
            {connectionStatus && (
              <div className="flex items-center gap-2">
                {connectionStatus === 'open' ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">Conectado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-destructive font-medium">
                      {connectionStatus === 'close' ? 'Desconectado' : connectionStatus}
                    </span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Webhook
            </CardTitle>
            <CardDescription>
              Configure o webhook para receber mensagens automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>URL do Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast({ title: 'URL copiada!' });
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={configureWebhook} disabled={!instanceName}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Webhook Automaticamente
              </Button>
              {config?.webhook_configured && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Configurado
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Criar tickets automaticamente</Label>
                <p className="text-sm text-muted-foreground">
                  Cria um ticket quando uma mensagem é recebida de um contato mapeado
                </p>
              </div>
              <Switch checked={autoCreateTicket} onCheckedChange={setAutoCreateTicket} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Notificar atualizações via WhatsApp</Label>
                <p className="text-sm text-muted-foreground">
                  Envia mensagens ao cliente quando o ticket é atualizado
                </p>
              </div>
              <Switch checked={autoNotify} onCheckedChange={setAutoNotify} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Mensagem de boas-vindas</Label>
              <Textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="Mensagem automática ao receber novo chamado"
                rows={3}
              />
            </div>

            <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>
              {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        {/* Contact Mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mapeamento de Contatos
            </CardTitle>
            <CardDescription>
              Vincule números de WhatsApp a empresas para criação automática de tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contacts && contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((contact: any) => (
                  <div key={contact.id} className="flex items-center gap-4 p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.contact_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground font-mono">{contact.phone_number}</p>
                    </div>
                    <Select
                      value={contact.company_id || 'none'}
                      onValueChange={(val) => updateContactCompany(contact.id, val === 'none' ? null : val)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Vincular empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem empresa</SelectItem>
                        {companies?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhum contato registrado ainda. Os contatos aparecerão aqui quando enviarem mensagens.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Mensagem de Teste
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Telefone (com DDI)</Label>
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={sendTestMessage} disabled={!instanceName || !testPhone}>
              <Send className="h-4 w-4 mr-2" />
              Enviar Teste
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
