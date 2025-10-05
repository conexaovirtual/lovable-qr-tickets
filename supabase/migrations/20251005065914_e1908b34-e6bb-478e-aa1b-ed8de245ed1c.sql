-- Phase 1: Block Anonymous Access to Sensitive Tables
-- Add explicit DENY policies for unauthenticated users

-- Companies table - Block anonymous access
CREATE POLICY "Block anonymous access to companies"
ON public.companies
FOR ALL
TO anon
USING (false);

-- Assets table - Block anonymous access
CREATE POLICY "Block anonymous access to assets"
ON public.assets
FOR ALL
TO anon
USING (false);

-- Tickets table - Block anonymous access
CREATE POLICY "Block anonymous access to tickets"
ON public.tickets
FOR ALL
TO anon
USING (false);

-- Profiles table - Block anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- Ticket comments - Block anonymous access
CREATE POLICY "Block anonymous access to ticket_comments"
ON public.ticket_comments
FOR ALL
TO anon
USING (false);

-- Ticket attachments - Block anonymous access
CREATE POLICY "Block anonymous access to ticket_attachments"
ON public.ticket_attachments
FOR ALL
TO anon
USING (false);

-- User roles - Block anonymous access
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false);