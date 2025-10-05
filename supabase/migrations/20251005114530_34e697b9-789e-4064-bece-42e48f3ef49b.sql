-- PHASE 3: SECURITY IMPROVEMENTS - Audit Logs Table
-- Create table for security audit logging

CREATE TABLE public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'login_failed', 'login_success', 'rate_limit_exceeded', 'unauthorized_access'
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  metadata jsonb, -- Extra data (email attempted, resource accessed, etc)
  severity text NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_audit_created_at ON security_audit_logs(created_at DESC);
CREATE INDEX idx_audit_severity ON security_audit_logs(severity);

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_logs FOR SELECT
USING (is_admin(auth.uid()));

-- Block anonymous access
CREATE POLICY "Block anonymous access to audit logs"
ON public.security_audit_logs FOR ALL
USING (false);

COMMENT ON TABLE public.security_audit_logs IS 'Security audit trail for monitoring authentication attempts and access patterns';
COMMENT ON COLUMN public.security_audit_logs.event_type IS 'Type of security event: login_failed, login_success, rate_limit_exceeded, unauthorized_access';
COMMENT ON COLUMN public.security_audit_logs.severity IS 'Event severity level: info, warning, critical';