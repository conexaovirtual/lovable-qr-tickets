-- Remove blocking policies that prevent anonymous access via QR code
-- These policies were preventing the public ticket submission flow from working

-- Remove blocking policy from assets table
DROP POLICY IF EXISTS "Block anonymous access to assets" ON public.assets;

-- Remove blocking policy from companies table
DROP POLICY IF EXISTS "Block anonymous access to companies" ON public.companies;

-- Remove blocking policy from tickets table
DROP POLICY IF EXISTS "Block anonymous access to tickets" ON public.tickets;

-- The following permissive policies remain active:
-- 1. "Allow public access to assets via qrcode_token" - allows SELECT on assets with qrcode_token
-- 2. "Allow public access to companies via asset qrcode" - allows SELECT on companies linked to assets with qrcode_token
-- 3. "Permitir criação de tickets públicos via QR code" - allows INSERT of tickets with public_request = true
-- 4. "Tickets públicos podem ser vistos pelo criador" - allows SELECT of public tickets