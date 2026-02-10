-- Add clinic_id to branding_settings table to support multi-clinic branding

-- Add clinic_id column (nullable initially for existing data)
ALTER TABLE branding_settings
ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE;

-- Create index for faster clinic-based queries
CREATE INDEX IF NOT EXISTS idx_branding_settings_clinic_id
ON branding_settings(clinic_id);

-- Update RLS policies to be clinic-specific
DROP POLICY IF EXISTS "Allow public read access to branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Allow public insert of branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Allow public update of branding settings" ON branding_settings;
DROP POLICY IF EXISTS "Allow public delete of branding settings" ON branding_settings;

-- Allow users to read branding for clinics they belong to
CREATE POLICY "Users can read branding for their clinics"
  ON branding_settings
  FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow users to insert branding for clinics they're admins of
CREATE POLICY "Admins can insert branding for their clinics"
  ON branding_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Allow users to update branding for clinics they're admins of
CREATE POLICY "Admins can update branding for their clinics"
  ON branding_settings
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- Allow users to delete branding for clinics they're admins of
CREATE POLICY "Admins can delete branding for their clinics"
  ON branding_settings
  FOR DELETE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );
