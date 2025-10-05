-- PHASE 1: CRITICAL SECURITY FIXES - CORRECTED ORDER
-- Remove legacy role column from profiles table to prevent privilege escalation

-- 1. First, drop the OLD policies that depend on profiles.role
DROP POLICY IF EXISTS "Users can view comments from their tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users can view attachments from their tickets" ON public.ticket_attachments;

-- 2. Now drop the legacy role column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 3. Create NEW RLS policies using security definer functions

-- Fix ticket_comments SELECT policy (no longer references profiles.role)
CREATE POLICY "Users can view comments from their tickets" 
ON public.ticket_comments 
FOR SELECT 
USING (
  ticket_id IN (
    SELECT t.id
    FROM tickets t
    WHERE t.company_id IN (
      SELECT p.company_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'tecnico'::user_role)
  )
);

-- Fix ticket_attachments SELECT policy (no longer references profiles.role)
CREATE POLICY "Users can view attachments from their tickets" 
ON public.ticket_attachments 
FOR SELECT 
USING (
  ticket_id IN (
    SELECT t.id
    FROM tickets t
    WHERE t.company_id IN (
      SELECT p.company_id
      FROM profiles p
      WHERE p.id = auth.uid()
    )
    OR is_admin(auth.uid())
    OR has_role(auth.uid(), 'tecnico'::user_role)
  )
);