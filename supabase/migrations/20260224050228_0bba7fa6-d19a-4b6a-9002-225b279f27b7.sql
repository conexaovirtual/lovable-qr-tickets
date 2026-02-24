
-- Add assignment tracking to waba_conversations
ALTER TABLE public.waba_conversations
  ADD COLUMN assigned_to uuid REFERENCES public.profiles(id),
  ADD COLUMN queue_status text NOT NULL DEFAULT 'waiting' CHECK (queue_status IN ('waiting', 'assigned', 'resolved')),
  ADD COLUMN first_response_at timestamptz,
  ADD COLUMN resolved_at timestamptz;
