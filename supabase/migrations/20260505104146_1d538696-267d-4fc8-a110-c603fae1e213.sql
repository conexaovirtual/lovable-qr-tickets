-- Create storage bucket for WhatsApp attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('waba-attachments', 'waba-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload waba attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'waba-attachments');

-- Public read access
CREATE POLICY "Public can read waba attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'waba-attachments');

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete waba attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'waba-attachments');