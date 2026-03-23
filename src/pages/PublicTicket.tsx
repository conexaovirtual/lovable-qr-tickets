import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";


export default function PublicTicket() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const assetId = searchParams.get("asset");
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [asset, setAsset] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [createdTicket, setCreatedTicket] = useState<any>(null);
  const [showActionsDialog, setShowActionsDialog] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    contato: "",
    descricao: "",
  });

  useEffect(() => {
    if (!assetId || !token) {
      toast({
        title: "Link inválido",
        description: "Este link de abertura de chamado não é válido.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    loadAssetData();
  }, [assetId, token]);

  const loadAssetData = async () => {
    try {
      setLoading(true);

      // Verificar token e buscar ativo
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .select("*, companies(*)")
        .eq("id", assetId)
        .eq("qrcode_token", token)
        .single();

      if (assetError || !assetData) {
        toast({
          title: "Token inválido",
          description: "Este QR Code não é válido ou expirou.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setAsset(assetData);
      setCompany(assetData.companies);
    } catch (error) {
      console.error("Error loading asset:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do ativo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.contato || !formData.descricao) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Criar ticket público
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          company_id: company.id,
          asset_id: asset.id,
          titulo: `Chamado via QR Code - ${asset.nome}`,
          descricao: formData.descricao,
          public_request: true,
          solicitante_nome: formData.nome,
          solicitante_contato: formData.contato,
          status: "novo",
          impacto: "medio",
          urgencia: "media",
          canal: "web",
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Chamar edge function para notificar
      const { error: notifyError } = await supabase.functions.invoke("notify-ticket-created", {
        body: {
          ticketId: ticket.id,
          ticketNumero: ticket.numero,
          assetNome: asset.nome,
          assetTipo: asset.tipo,
          assetTag: asset.tag_patrimonial,
          companyNome: company.nome_fantasia,
          solicitanteNome: formData.nome,
          solicitanteContato: formData.contato,
          descricao: formData.descricao,
        },
      });

      if (notifyError) {
        console.error("Error sending notification:", notifyError);
      }

      setCreatedTicket(ticket);
      setSuccess(true);
      setShowActionsDialog(true);

      // Chamar auto-resposta IA (fire and forget)
      supabase.functions.invoke('ai-auto-response', {
        body: { ticket_id: ticket.id, descricao: formData.descricao },
      }).catch(err => console.error('AI auto-response error:', err));
      
      toast({
        title: "Chamado criado!",
        description: "Seu chamado foi registrado com sucesso. Em breve entraremos em contato.",
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o chamado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!asset || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Link Inválido</CardTitle>
            </div>
            <CardDescription>
              Este link de abertura de chamado não é válido ou expirou.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>Chamado Criado!</CardTitle>
            </div>
            <CardDescription>
              Seu chamado foi registrado com sucesso. Em breve entraremos em contato através do{" "}
              {formData.contato}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Detalhes do chamado:</p>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Número:</span> #{createdTicket?.numero}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ativo:</span> {asset.nome}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Empresa:</span> {company.nome_fantasia}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Solicitante:</span> {formData.nome}
                  </p>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowActionsDialog(true)}
              >
                Abrir Atendimento / Ordem de Serviço
              </Button>
              
              <p className="text-sm text-muted-foreground text-center">
                Você pode fechar esta página agora.
              </p>
            </div>
          </CardContent>
        </Card>

        {createdTicket && (
          <PublicTicketActionsDialog
            open={showActionsDialog}
            onOpenChange={setShowActionsDialog}
            ticketId={createdTicket.id}
            ticketNumber={createdTicket.numero}
            companyId={company.id}
            assetId={asset.id}
            ticketTitle={`Chamado via QR Code - ${asset.nome}`}
            ticketDescription={formData.descricao}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">📋 Abertura de Chamado Técnico</CardTitle>
            <CardDescription>
              Preencha o formulário abaixo para abrir um chamado de suporte técnico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informações do Ativo */}
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  🖥️ Equipamento
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ativo:</span>
                    <span className="font-medium">{asset.nome}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant="outline" className="capitalize">
                      {asset.tipo}
                    </Badge>
                  </div>
                  {asset.tag_patrimonial && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tag:</span>
                      <span className="font-mono text-xs">{asset.tag_patrimonial}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações da Empresa */}
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  🏢 Empresa
                </h3>
                <div className="text-sm">
                  <span className="font-medium">{company.nome_fantasia}</span>
                </div>
              </div>

              {/* Formulário */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">Seu nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Digite seu nome completo"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contato">Email ou Telefone *</Label>
                  <Input
                    id="contato"
                    placeholder="seu@email.com ou (11) 99999-9999"
                    value={formData.contato}
                    onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usaremos este contato para retornar sobre o chamado
                  </p>
                </div>

                <div>
                  <Label htmlFor="descricao">Descrição do problema *</Label>
                  <Textarea
                    id="descricao"
                    placeholder="Descreva o problema ou solicitação..."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={5}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Chamado"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
