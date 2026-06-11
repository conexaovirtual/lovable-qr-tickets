import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchDashboardStats(profileId: string, roles: string[]) {
  const isAdmin = roles.includes("admin_provedor");
  const isAdminOrTech = isAdmin || roles.includes("tecnico");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const todayStr = today.toISOString().split("T")[0];

  const results = await Promise.allSettled([
    supabase.from("assets").select("id", { count: "exact", head: true }),
    isAdmin
      ? supabase.from("companies").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: 0 }),
    supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .gte("data_agendada", today.toISOString())
      .lt("data_agendada", tomorrow.toISOString())
      .in("status", ["agendada", "confirmada", "em_execucao"]),
    supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["agendada", "confirmada"]),
    supabase.from("service_orders").select("id", { count: "exact", head: true }).eq("status", "finalizada"),
    supabase
      .from("service_orders")
      .select("id, numero_os, data_agendada, hora_agendada, status, companies(nome_fantasia), profiles!service_orders_tecnico_id_fkey(nome)")
      .gte("data_agendada", today.toISOString())
      .lte("data_agendada", nextWeek.toISOString())
      .in("status", ["agendada", "confirmada"])
      .order("data_agendada", { ascending: true })
      .limit(5),
    supabase
      .from("daily_service_records")
      .select("id, titulo, data_atendimento, status, companies(nome_fantasia)")
      .gte("data_atendimento", firstDayOfMonth.toISOString().split("T")[0])
      .order("data_atendimento", { ascending: false })
      .limit(5),
    isAdminOrTech
      ? supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("public_request", true)
          .eq("status", "novo")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("daily_service_records")
      .select("id", { count: "exact", head: true })
      .eq("data_atendimento", todayStr)
      .eq("canal", "acesso_remoto"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "novo"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "em_atendimento"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "resolvido"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "fechado"),
  ]);

  const getValue = (r: PromiseSettledResult<any>) =>
    r.status === "fulfilled" ? (r.value?.count ?? r.value?.data?.length ?? 0) : 0;

  const [
    assetsR, companiesR, osHojeR, osPendentesR, osFinalizadasR,
    upcomingR, atendimentosR, qrcodeR, remotosR,
    tNovo, tAtend, tResolvido, tFechado,
  ] = results;

  return {
    stats: {
      ativos: getValue(assetsR),
      empresas: getValue(companiesR),
      os_agendadas_hoje: getValue(osHojeR),
      os_pendentes: getValue(osPendentesR),
      os_finalizadas: getValue(osFinalizadasR),
      atendimentos_mes: atendimentosR.status === "fulfilled" ? (atendimentosR.value?.data?.length ?? 0) : 0,
      chamados_qrcode: getValue(qrcodeR),
      atendimentos_remotos_hoje: getValue(remotosR),
      tickets_novo: getValue(tNovo),
      tickets_em_atendimento: getValue(tAtend),
      tickets_resolvido: getValue(tResolvido),
      tickets_fechado: getValue(tFechado),
    },
    upcomingServiceOrders: upcomingR.status === "fulfilled" ? (upcomingR.value?.data ?? []) : [],
    recentServices: atendimentosR.status === "fulfilled" ? (atendimentosR.value?.data ?? []) : [],
  };
}

export function useDashboardData(profileId: string | undefined, roles: string[] | undefined) {
  return useQuery({
    queryKey: ["dashboard", profileId, new Date().toISOString().split("T")[0]],
    queryFn: () => fetchDashboardStats(profileId!, roles ?? []),
    enabled: !!profileId,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
