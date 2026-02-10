-- Add soft delete support to patients table

-- Add soft delete columns to patients
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS delete_reason text;

-- Add index for faster queries on non-deleted patients
CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON patients(deleted_at) WHERE deleted_at IS NULL;

-- Add comment explaining soft delete
COMMENT ON COLUMN patients.deleted_at IS 'Timestamp when patient was soft-deleted. NULL means patient is active.';
COMMENT ON COLUMN patients.deleted_by IS 'User ID who deleted the patient. Must be an admin.';
COMMENT ON COLUMN patients.delete_reason IS 'Reason provided for deleting the patient.';

-- Update RLS policies to exclude soft-deleted patients by default
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can read patients from their clinics" ON patients;
DROP POLICY IF EXISTS "Users can create patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Admins can update patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Admins can delete patients in their clinics" ON patients;

-- Recreate policies with soft delete filter
CREATE POLICY "Users can read non-deleted patients from their clinics"
  ON patients
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can create patients in their clinics"
  ON patients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can update non-deleted patients in their clinics"
  ON patients
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL AND
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

-- Only admins can soft delete patients (by setting deleted_at)
CREATE POLICY "Admins can soft delete patients in their clinics"
  ON patients
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM clinic_memberships
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );
