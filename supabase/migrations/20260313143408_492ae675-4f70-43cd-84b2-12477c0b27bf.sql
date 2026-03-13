UPDATE waba_conversations 
SET ai_enabled = true, queue_status = 'waiting' 
WHERE ai_enabled = false 
AND last_message_at < now() - interval '30 minutes'