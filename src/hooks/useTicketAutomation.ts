/**
 * useTicketAutomation
 * Hook que roda automações periódicas:
 *  1. Escalonamento por SLA: tickets vencendo em < 2h → notifica via push
 *  2. Fechamento automático: tickets "resolvido" há > 72h → fecha automaticamente
 */
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const SMART_ALERTS_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const SLA_ALERT_HOURS = 2;
const AUTO_CLOSE_HOURS = 72;

export function useTicketAutomation() {
  const { profile } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunRef = useRef<number>(0);

  const runAutomations = useCallback(async () => {
    if (!profile) return;
    const now = Date.now();
    if (now - lastRunRef.current < 60_000) return;
    lastRunRef.current = now;

    try {
      await Promise.allSettled([escalateSLATickets(profile), autoCloseResolvedTickets()]);
    } catch (err) {
      console.error("[useTicketAutomation] Erro:", err);
    }
  }, [profile]);

  // Gerar alertas inteligentes a cada hora no background
  useEffect(() => {
    if (!profile?.roles?.includes("admin_provedor")) return;
    const timer = setInterval(() => {
      supabase.functions.invoke("ai-smart-alerts", { body: {} }).catch(() => {});
    }, SMART_ALERTS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [profile]);

  useEffect(() => {
    if (!profile?.roles?.includes("admin_provedor") && !profile?.roles?.includes("tecnico")) return;

    runAutomations();

    timerRef.current = setInterval(runAutomations, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile, runAutomations]);
}

async function escalateSLATickets(profile: any) {
  const alertThreshold = new Date(Date.now() + SLA_ALERT_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: ticketsAtRisk } = await supabase
    .from("tickets")
    .select("id, numero, titulo, sla_solucao_limite, tecnico_id, companies(nome_fantasia)")
    .in("status", ["novo", "em_atendimento"])
    .not("sla_solucao_limite", "is", null)
    .lt("sla_solucao_limite", alertThreshold)
    .gt("sla_solucao_limite", now)
    .is("sla_escalado", null);

  if (!ticketsAtRisk?.length) return;

  for (const ticket of ticketsAtRisk) {
    await supabase
      .from("tickets")
      .update({ sla_escalado: new Date().toISOString() } as any)
      .eq("id", ticket.id);

    await supabase.functions
      .invoke("send-push-notification", {
        body: {
          user_id: ticket.tecnico_id || profile.id,
          title: `⚠️ SLA em risco — #${ticket.numero}`,
          body: `"${ticket.titulo}" vence em menos de ${SLA_ALERT_HOURS}h`,
          url: `/tickets/${ticket.id}`,
        },
      })
      .catch(() => {});
  }

  if (ticketsAtRisk.length > 0) {
    toast.warning(`${ticketsAtRisk.length} chamado(s) com SLA em risco foram escalonados.`);
  }
}

async function autoCloseResolvedTickets() {
  const closeThreshold = new Date(Date.now() - AUTO_CLOSE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: toClose } = await supabase
    .from("tickets")
    .select("id, numero")
    .eq("status", "resolvido")
    .lt("updated_at", closeThreshold);

  if (!toClose?.length) return;

  const ids = toClose.map((t) => t.id);

  await supabase
    .from("tickets")
    .update({
      status: "fechado",
      updated_at: new Date().toISOString(),
    } as any)
    .in("id", ids);

  console.log(`[Automação] ${ids.length} ticket(s) fechados automaticamente.`);
}
