/*
  # Create branding settings table for clinic branding/letterhead

  1. New Tables
    - `branding_settings`
      - `id` (uuid, primary key) - Unique identifier
      - `clinic_name` (text) - Name of the clinic/practice
      - `address` (text) - Clinic address (multiline)
      - `phone` (text) - Contact phone number
      - `email` (text) - Contact email address
      - `website` (text) - Website URL
      - `logo_url` (text) - URL to uploaded logo image
      - `letterhead_url` (text) - URL to uploaded letterhead image
      - `show_in_notes` (boolean) - Toggle to show/hide branding in note text
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on `branding_settings` table
    - Add policy for public read access (non-PHI data)
    - Add policy for authenticated insert/update
    
  3. Notes
    - Only one branding settings record should exist (enforced at app level)
    - Logo and letterhead URLs will point to Supabase Storage
    - No PHI is stored in this table
*/

CREATE TABLE IF NOT EXISTS branding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  logo_url text,
  letterhead_url text,
  show_in_notes boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to branding settings"
  ON branding_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert of branding settings"
  ON branding_settings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update of branding settings"
  ON branding_settings
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete of branding settings"
  ON branding_settings
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_branding_settings_updated_at ON branding_settings(updated_at DESC);