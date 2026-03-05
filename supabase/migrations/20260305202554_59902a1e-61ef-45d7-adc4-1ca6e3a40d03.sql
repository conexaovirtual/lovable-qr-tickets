
-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planejamento',
  priority text NOT NULL DEFAULT 'media',
  start_date date,
  due_date date,
  progress integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and technicians can manage projects"
  ON public.projects FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

CREATE POLICY "Users can view projects from their company"
  ON public.projects FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) OR is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

-- Project tasks table
CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'a_fazer',
  priority text NOT NULL DEFAULT 'media',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and technicians can manage project tasks"
  ON public.project_tasks FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

CREATE POLICY "Users can view tasks from their projects"
  ON public.project_tasks FOR SELECT TO authenticated
  USING (project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())) OR is_admin(auth.uid()) OR has_role(auth.uid(), 'tecnico'::user_role));

-- Cost centers table
CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'despesa',
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cost centers"
  ON public.cost_centers FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Managers can view their company cost centers"
  ON public.cost_centers FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'gestor_cliente'::user_role));

CREATE POLICY "Technicians can view cost centers"
  ON public.cost_centers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'tecnico'::user_role));
