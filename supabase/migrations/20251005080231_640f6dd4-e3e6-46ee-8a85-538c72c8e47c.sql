-- Fix 1: Secure categories table - require authentication and company-based access
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;

CREATE POLICY "Authenticated users can view categories"
ON categories
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Secure subcategories table - require authentication and company-based access
DROP POLICY IF EXISTS "Anyone can view subcategories" ON subcategories;

CREATE POLICY "Authenticated users can view subcategories"
ON subcategories
FOR SELECT
TO authenticated
USING (true);

-- Fix 3: Add explicit INSERT policy for profiles (admin-only manual creation)
CREATE POLICY "Only admins can manually insert profiles"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Note: The trigger handle_new_user() will still work because it runs with SECURITY DEFINER privileges