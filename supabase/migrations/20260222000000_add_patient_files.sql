-- Migration: Add patient_files table
-- Purpose: Store documents (consent forms, referrals, etc.) for patients
-- without requiring an episode. Used by PTBot integration to sync
-- telehealth consent forms and physician referrals.

CREATE TABLE IF NOT EXISTS patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL,

  -- File classification
  file_type TEXT NOT NULL,  -- 'consent_form', 'referral', 'insurance_card', 'other'
  file_name TEXT NOT NULL,
  file_url TEXT,            -- Public URL or signed URL
  storage_path TEXT,        -- Path in Supabase Storage bucket
  file_size INTEGER,
  mime_type TEXT,

  -- Status tracking
  status TEXT DEFAULT 'received',  -- 'pending', 'received', 'verified', 'expired'
  uploaded_by TEXT,                 -- 'ptbot', 'clinic', or user identifier

  -- Additional metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_patient_files_patient ON patient_files(patient_id);
CREATE INDEX idx_patient_files_clinic ON patient_files(clinic_id);
CREATE INDEX idx_patient_files_type ON patient_files(file_type);
CREATE INDEX idx_patient_files_patient_type ON patient_files(patient_id, file_type);

-- Auto-update timestamps
DROP TRIGGER IF EXISTS trigger_patient_files_updated_at ON patient_files;
CREATE TRIGGER trigger_patient_files_updated_at
  BEFORE UPDATE ON patient_files FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_files_all" ON patient_files FOR ALL USING (true);

COMMENT ON TABLE patient_files IS 'Patient documents (consent forms, referrals, etc.) synced from PTBot or uploaded by clinic staff';
