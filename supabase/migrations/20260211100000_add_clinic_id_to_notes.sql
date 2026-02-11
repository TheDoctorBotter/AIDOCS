/*
  # Add clinic_id to notes table

  The legacy notes table was not clinic-aware.
  This adds a clinic_id column so notes are scoped per clinic,
  preventing data from leaking across clinic boundaries.

  1. Changes
    - Add `clinic_id` UUID column (nullable for existing rows)
    - Add foreign key reference to clinics table
    - Add index for fast clinic-scoped queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'clinic_id'
  ) THEN
    ALTER TABLE notes ADD COLUMN clinic_id UUID REFERENCES clinics(id);
    CREATE INDEX IF NOT EXISTS idx_notes_clinic ON notes(clinic_id);
  END IF;
END $$;
