
CREATE TABLE public.datto_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.datto_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only backend (service role) should access this table
-- No RLS policies = no client access, only service_role can read/write
