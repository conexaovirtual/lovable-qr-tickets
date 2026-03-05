import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, FolderKanban, Calendar, User, Building2, ChevronRight, GripVertical,
  CheckCircle2, Clock, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";

const statusLabels: Record<string, { label: string; color: string }> = {
  planejamento: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500/10 text-blue-600" },
  pausado: { label: "Pausado", color: "bg-yellow-500/10 text-yellow-600" },
  concluido: { label: "Concluído", color: "bg-green-500/10 text-green-600" },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
};

const taskStatusLabels: Record<string, { label: string; color: string }> = {
  a_fazer: { label: "A Fazer", color: "bg-muted text-muted-foreground" },
  fazendo: { label: "Fazendo", color: "bg-blue-500/10 text-blue-600" },
  feito: { label: "Feito", color: "bg-green-500/10 text-green-600" },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-yellow-500/10 text-yellow-600" },
  alta: { label: "Alta", color: "bg-orange-500/10 text-orange-600" },
  critica: { label: "Crítica", color: "bg-destructive/10 text-destructive" },
};

const Projects = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", company_id: "", priority: "media", start_date: "", due_date: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", assigned_to: "", priority: "media", due_date: "" });

  const isAdmin = profile?.roles?.includes("admin_provedor");
  const isTech = profile?.roles?.includes("tecnico");
  const canManage = isAdmin || isTech;

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome_fantasia").eq("status", true).order("nome_fantasia");
      return data || [];
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["admin_provedor", "tecnico"]);
      if (!roles?.length) return [];
      const { data } = await supabase.from("profiles").select("id, nome").in("id", roles.map((r) => r.user_id));
      return data || [];
    },
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks", selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject) return [];
      const { data } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", selectedProject.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedProject,
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        name: form.name,
        description: form.description || null,
        company_id: form.company_id || null,
        priority: form.priority,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        created_by: user?.id,
        responsible_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setProjectDialogOpen(false);
      setForm({ name: "", description: "", company_id: "", priority: "media", start_date: "", due_date: "" });
      toast({ title: "Projeto criado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_tasks").insert({
        project_id: selectedProject.id,
        title: taskForm.title,
        description: taskForm.description || null,
        assigned_to: taskForm.assigned_to || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", selectedProject?.id] });
      setTaskDialogOpen(false);
      setTaskForm({ title: "", description: "", assigned_to: "", priority: "media", due_date: "" });
      toast({ title: "Tarefa criada!" });
      recalcProgress();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    await supabase.from("project_tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", taskId);
    queryClient.invalidateQueries({ queryKey: ["project-tasks", selectedProject?.id] });
    recalcProgress();
  };

  const recalcProgress = async () => {
    if (!selectedProject) return;
    const { data: allTasks } = await supabase.from("project_tasks").select("status").eq("project_id", selectedProject.id);
    if (!allTasks?.length) return;
    const done = allTasks.filter((t) => t.status === "feito").length;
    const progress = Math.round((done / allTasks.length) * 100);
    await supabase.from("projects").update({ progress, updated_at: new Date().toISOString() }).eq("id", selectedProject.id);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const updateProjectStatus = async (projectId: string, newStatus: string) => {
    await supabase.from("projects").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", projectId);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (selectedProject?.id === projectId) setSelectedProject((p: any) => ({ ...p, status: newStatus }));
  };

  const getCompanyName = (id: string) => companies.find((c) => c.id === id)?.nome_fantasia || "—";
  const getTechName = (id: string) => technicians.find((t) => t.id === id)?.nome || "—";

  const taskColumns = ["a_fazer", "fazendo", "feito"];

  const handleTaskDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) updateTaskStatus(taskId, newStatus);
  };

  const activeCount = projects.filter((p: any) => p.status === 'em_andamento').length;
  const doneCount = projects.filter((p: any) => p.status === 'concluido').length;

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        subtitle="Gerencie projetos e tarefas da equipe"
        metrics={[
          { icon: FolderKanban, label: "Total", value: projects.length, color: "bg-blue-600/90" },
          { icon: Clock, label: "Em Andamento", value: activeCount, color: "bg-amber-600/90" },
          { icon: CheckCircle2, label: "Concluídos", value: doneCount, color: "bg-emerald-600/90" },
        ]}
        actions={
          canManage ? (
            <Button size="sm" className="h-8 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white border-0" onClick={() => setProjectDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Novo Projeto</span>
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Project List */}
        <div className={`w-full md:w-80 lg:w-96 border-r bg-card flex flex-col shrink-0 ${selectedProject ? "hidden md:flex" : "flex"}`}>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm"><Loader2 className="h-6 w-6 mx-auto animate-spin" /></div>
            ) : projects.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <FolderKanban className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Nenhum projeto</p>
              </div>
            ) : (
              <div className="p-1 space-y-1">
                {projects.map((p: any) => {
                  const st = statusLabels[p.status] || statusLabels.planejamento;
                  const pr = priorityLabels[p.priority] || priorityLabels.media;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${selectedProject?.id === p.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={`text-[10px] px-1.5 py-0 ${st.color}`}>{st.label}</Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 ${pr.color}`}>{pr.label}</Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Progresso</span>
                          <span>{p.progress}%</span>
                        </div>
                        <Progress value={p.progress} className="h-1.5" />
                      </div>
                      {p.company_id && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                          <Building2 className="h-3 w-3" />{getCompanyName(p.company_id)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Task Board */}
        <div className={`flex-1 flex flex-col min-w-0 ${!selectedProject ? "hidden md:flex" : "flex"}`}>
          {selectedProject ? (
            <>
              <div className="h-auto min-h-[3rem] border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-card shrink-0">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedProject(null)}>←</Button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{selectedProject.name}</h3>
                  {selectedProject.description && <p className="text-xs text-muted-foreground truncate">{selectedProject.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <Select value={selectedProject.status} onValueChange={(v) => updateProjectStatus(selectedProject.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {canManage && (
                    <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7 text-xs gap-1"><Plus className="h-3 w-3" /> Tarefa</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
                        <div className="space-y-3 mt-2">
                          <Input placeholder="Título *" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                          <Textarea placeholder="Descrição" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} />
                          <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}>
                            <SelectTrigger><SelectValue placeholder="Responsável (opcional)" /></SelectTrigger>
                            <SelectContent>{technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <div><label className="text-xs text-muted-foreground">Prazo</label><Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} /></div>
                          <Button onClick={() => createTask.mutate()} disabled={!taskForm.title.trim() || createTask.isPending} className="w-full">
                            {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Tarefa"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Kanban Columns */}
              <div className="flex-1 overflow-auto p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-h-full">
                  {taskColumns.map((col) => {
                    const colInfo = taskStatusLabels[col];
                    const colTasks = tasks.filter((t: any) => t.status === col);
                    return (
                      <div
                        key={col}
                        className="bg-muted/30 rounded-lg p-2 flex flex-col min-h-[200px]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleTaskDrop(e, col)}
                      >
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                          {col === "a_fazer" && <Clock className="h-4 w-4 text-muted-foreground" />}
                          {col === "fazendo" && <AlertCircle className="h-4 w-4 text-blue-500" />}
                          {col === "feito" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          <span className="text-xs font-semibold uppercase tracking-wider">{colInfo.label}</span>
                          <Badge variant="secondary" className="text-[10px] ml-auto">{colTasks.length}</Badge>
                        </div>
                        <div className="space-y-2 flex-1">
                          {colTasks.map((task: any) => {
                            const tp = priorityLabels[task.priority] || priorityLabels.media;
                            return (
                              <Card
                                key={task.id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                                className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-start gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-40" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{task.title}</p>
                                      {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Badge className={`text-[10px] px-1.5 py-0 ${tp.color}`}>{tp.label}</Badge>
                                        {task.assigned_to && (
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                            <User className="h-3 w-3" />{getTechName(task.assigned_to)}
                                          </span>
                                        )}
                                        {task.due_date && (
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                            <Calendar className="h-3 w-3" />{format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FolderKanban className="h-16 w-16 mx-auto mb-3 opacity-20" />
                <p className="text-lg font-medium">Projetos</p>
                <p className="text-sm">Selecione um projeto para ver as tarefas</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Nome do projeto *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Empresa (opcional)" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Prazo</label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <Button onClick={() => createProject.mutate()} disabled={!form.name.trim() || createProject.isPending} className="w-full">
              {createProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Projeto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
