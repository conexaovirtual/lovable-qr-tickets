-- Allow public access to assets via qrcode_token
CREATE POLICY "Allow public access to assets via qrcode_token"
ON assets
FOR SELECT
TO public
USING (qrcode_token IS NOT NULL);

-- Allow public access to companies via asset qrcode
CREATE POLICY "Allow public access to companies via asset qrcode"
ON companies
FOR SELECT
TO public
USING (
  id IN (
    SELECT company_id FROM assets WHERE qrcode_token IS NOT NULL
  )
);