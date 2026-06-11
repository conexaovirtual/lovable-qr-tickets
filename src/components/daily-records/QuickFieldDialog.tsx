/**
 * QuickFieldDialog — Modo Campo
 * Formulário simplificado para registrar atendimentos rapidamente em campo.
 * Apenas 3 campos obrigatórios: empresa, descrição e status.
 * Todo o resto é preenchido automaticamente (data, hora, localização, técnico).
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { VoiceInputButton } from "@/components/ui/VoiceInputButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MapPin, Clock, CheckCircle2, AlertCircle, Loader2,
  Building2, Zap, MessageSquare, Send, Monitor,
} from "lucide-react";

interface Company {
  id: string;
  nome_fantasia: string;
  telefone?: string;
}

interface Asset {
  id: string;
  nome: string;
  tipo?: string;
  tag_patrimonial?: string;
}

interface QuickFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuickFieldDialog({ open, onOpenChange, onSuccess }: QuickFieldDialogProps) {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [solucao, setSolucao] = useState("");
  const [status, setStatus] = useState<"concluido" | "em_andamento" | "pendente">("concluido");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [horaInicio] = useState(() => format(new Date(), "HH:mm"));
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  useEffect(() => {
    if (open) {
      loadCompanies();
      captureLocation();
    } else {
      // reset
      setCompanyId("");
      setAssetId("");
      setAssets([]);
      setDescricao("");
      setSolucao("");
      setStatus("concluido");
      setLocation(null);
    }
  }, [open]);

  const loadAssets = async (cId: string) => {
    if (!cId) { setAssets([]); return; }
    const { data } = await supabase
      .from("assets")
      .select("id, nome, tipo, tag_patrimonial")
      .eq("company_id", cId)
      .order("nome");
    setAssets(data || []);
    setAssetId("");
  };

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, nome_fantasia, telefone")
      .order("nome_fantasia");
    console.log("[QuickField] companies:", data?.length, error);
    if (data) setCompanies(data);
  };

  const captureLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!companyId) { toast.error("Selecione a empresa"); return; }
    if (!descricao.trim()) { toast.error("Descreva o atendimento"); return; }
    if (!profile?.id) return;

    setLoading(true);
    try {
      const now = new Date();
      const titulo = descricao.slice(0, 60).trim() + (descricao.length > 60 ? "..." : "");

      const { data: record, error } = await supabase
        .from("daily_service_records")
        .insert({
          company_id: companyId,
          tecnico_id: profile.id,
          data_atendimento: format(now, "yyyy-MM-dd"),
          hora_inicio: horaInicio,
          hora_fim: format(now, "HH:mm"),
          canal: "visita_tecnica",
          titulo,
          descricao: descricao.trim(),
          solucao: solucao.trim() || null,
          status,
          asset_id: assetId && assetId !== "none" ? assetId : null,
          latitude_inicio: location?.lat ?? null,
          longitude_inicio: location?.lng ?? null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success("✅ Atendimento registrado!");

      // Dispara notificação WhatsApp se concluído e opção ativada
      if (status === "concluido" && sendWhatsApp && record) {
        supabase.functions.invoke("notify-daily-record-status", {
          body: {
            daily_record_id: record.id,
            new_status: "concluido",
            observacao: solucao || descricao,
          },
        }).then(({ error: fnErr }) => {
          if (!fnErr) toast.success("📱 Comprovante enviado via WhatsApp!");
        }).catch(() => {});
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === companyId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-300" />
            <DialogTitle className="text-white text-lg">Modo Campo</DialogTitle>
          </div>
          <div className="flex items-center gap-3 mt-2 text-blue-100 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(new Date(), "HH:mm")} · {format(new Date(), "dd/MM/yyyy")}</span>
            </div>
            <div className="flex items-center gap-1">
              {locating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Localizando...</span></>
              ) : location ? (
                <><MapPin className="h-3.5 w-3.5 text-green-300" /><span className="text-green-300">GPS capturado</span></>
              ) : (
                <><MapPin className="h-3.5 w-3.5" /><span>Sem GPS</span></>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Empresa */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Empresa *
            </label>
            <Select value={companyId} onValueChange={(v) => { setCompanyId(v); loadAssets(v); }}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione o cliente..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ativo (aparece após selecionar empresa) */}
          {companyId && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Ativo / Equipamento
                <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={assets.length ? "Selecione o equipamento..." : "Nenhum ativo cadastrado"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum ativo específico —</SelectItem>
                  {assets.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}{a.tag_patrimonial ? ` · ${a.tag_patrimonial}` : ""}{a.tipo ? ` (${a.tipo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* O que fez */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">O que foi feito? *</label>
            <div className="relative">
              <Textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Descreva rapidamente o atendimento..."
                rows={3}
                className="pr-10 resize-none"
              />
              <div className="absolute bottom-2 right-2">
                <VoiceInputButton
                  onTranscript={text => setDescricao(prev => prev ? prev + " " + text : text)}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Solução (opcional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-muted-foreground">Solução aplicada (opcional)</label>
            <div className="relative">
              <Textarea
                value={solucao}
                onChange={e => setSolucao(e.target.value)}
                placeholder="Como foi resolvido?"
                rows={2}
                className="pr-10 resize-none text-sm"
              />
              <div className="absolute bottom-2 right-2">
                <VoiceInputButton
                  onTranscript={text => setSolucao(prev => prev ? prev + " " + text : text)}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "concluido", label: "Concluído", icon: CheckCircle2, color: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
                { value: "em_andamento", label: "Em andamento", icon: Loader2, color: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
                { value: "pendente", label: "Pendente", icon: AlertCircle, color: "border-slate-400 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400" },
              ].map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value as any)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-xs font-medium ${
                    status === value ? color + " border-opacity-100" : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp comprovante */}
          {status === "concluido" && selectedCompany && (
            <button
              type="button"
              onClick={() => setSendWhatsApp(!sendWhatsApp)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                sendWhatsApp
                  ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                  : "border-border bg-background"
              }`}
            >
              <MessageSquare className={`h-5 w-5 ${sendWhatsApp ? "text-green-600" : "text-muted-foreground"}`} />
              <div className="text-left flex-1">
                <p className={`text-sm font-semibold ${sendWhatsApp ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                  Enviar comprovante WhatsApp
                </p>
                <p className="text-xs text-muted-foreground">{selectedCompany.nome_fantasia}</p>
              </div>
              {sendWhatsApp && <Send className="h-4 w-4 text-green-600" />}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-0 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={loading || !companyId || !descricao.trim()}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> Registrar</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
