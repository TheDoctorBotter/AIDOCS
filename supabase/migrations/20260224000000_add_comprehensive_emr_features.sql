-- ============================================================================
-- COMPREHENSIVE EMR FEATURES MIGRATION
-- Adds: Scheduling enhancements, Outcome Measures, Goals, CPT/Billing,
--        Co-signatures, Exercise Library, Reporting, Messaging, Audit,
--        Provider Profiles, Prior Authorization
-- Additive migration: no existing tables/columns/policies are changed.
-- ============================================================================

-- ============================================================================
-- 1. SCHEDULING ENHANCEMENTS
-- ============================================================================

-- Appointment status enum
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'scheduled', 'checked_in', 'in_progress', 'checked_out',
    'completed', 'no_show', 'cancelled', 'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add status and recurrence columns to visits
ALTER TABLE visits ADD COLUMN IF NOT EXISTS status appointment_status DEFAULT 'scheduled';
ALTER TABLE visits ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS recurrence_rule TEXT; -- iCal RRULE format
ALTER TABLE visits ADD COLUMN IF NOT EXISTS recurrence_group_id UUID;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_type TEXT DEFAULT 'treatment'; -- treatment, evaluation, re_evaluation, discharge

CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_recurrence_group ON visits(recurrence_group_id);

-- Therapist availability / schedule blocks
CREATE TABLE IF NOT EXISTS therapist_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE, -- false = blocked/time-off
  label TEXT, -- e.g. "Lunch", "Admin Time"
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_avail_user ON therapist_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_therapist_avail_clinic ON therapist_availability(clinic_id);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
  preferred_therapist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  preferred_days INTEGER[], -- 0=Sun..6=Sat
  preferred_time_start TIME,
  preferred_time_end TIME,
  priority INTEGER DEFAULT 0, -- higher = more urgent
  notes TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'scheduled', 'removed')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_clinic ON waitlist(clinic_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- ============================================================================
-- 2. STANDARDIZED OUTCOME MEASURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS outcome_measure_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL, -- e.g. "ODI", "NDI", "LEFS"
  description TEXT,
  category TEXT, -- e.g. "Spine", "Upper Extremity", "Lower Extremity", "Balance", "General"
  min_score NUMERIC,
  max_score NUMERIC,
  score_interpretation TEXT, -- JSON: { ranges: [{ min, max, label }] }
  questions JSONB, -- array of { id, text, options: [{ value, label }] }
  mcid NUMERIC, -- Minimal Clinically Important Difference
  higher_is_better BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outcome_measure_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  measure_id UUID NOT NULL REFERENCES outcome_measure_definitions(id) ON DELETE CASCADE,
  date_administered DATE NOT NULL DEFAULT CURRENT_DATE,
  raw_score NUMERIC NOT NULL,
  percentage_score NUMERIC, -- normalized 0-100
  answers JSONB, -- individual question responses
  administered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL, -- link to clinical doc
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcome_scores_patient ON outcome_measure_scores(patient_id);
CREATE INDEX IF NOT EXISTS idx_outcome_scores_episode ON outcome_measure_scores(episode_id);
CREATE INDEX IF NOT EXISTS idx_outcome_scores_measure ON outcome_measure_scores(measure_id);
CREATE INDEX IF NOT EXISTS idx_outcome_scores_date ON outcome_measure_scores(date_administered);

-- ============================================================================
-- 3. STRUCTURED GOALS (STG/LTG)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE goal_type AS ENUM ('short_term', 'long_term');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('active', 'met', 'not_met', 'modified', 'discontinued', 'deferred');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS treatment_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  goal_type goal_type NOT NULL,
  goal_number INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,

  -- Measurable criteria
  baseline_value TEXT,
  target_value TEXT,
  current_value TEXT,
  unit_of_measure TEXT, -- e.g. "degrees", "seconds", "feet", "reps", "%"

  -- Timeframes
  target_date DATE,
  met_date DATE,

  -- Status tracking
  status goal_status DEFAULT 'active',
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  status_notes TEXT,

  -- Linking
  parent_goal_id UUID REFERENCES treatment_goals(id) ON DELETE SET NULL, -- STG links to LTG
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL, -- created in which eval

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_episode ON treatment_goals(episode_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON treatment_goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_type ON treatment_goals(goal_type);

-- Goal progress history
CREATE TABLE IF NOT EXISTS goal_progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES treatment_goals(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_value TEXT,
  current_value TEXT,
  progress_percentage INTEGER CHECK (progress_percentage BETWEEN 0 AND 100),
  status goal_status,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress_notes(goal_id);

-- ============================================================================
-- 4. CPT CODES & BILLING
-- ============================================================================

CREATE TABLE IF NOT EXISTS cpt_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT, -- "Therapeutic Exercise", "Manual Therapy", "Evaluation", etc.
  is_timed BOOLEAN DEFAULT TRUE, -- timed vs untimed
  default_units INTEGER DEFAULT 1,
  unit_minutes INTEGER DEFAULT 15, -- for timed codes, minutes per unit
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visit charges (superbill line items)
CREATE TABLE IF NOT EXISTS visit_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  cpt_code_id UUID NOT NULL REFERENCES cpt_codes(id),
  cpt_code TEXT NOT NULL,
  description TEXT,

  -- Timing (for 8-minute rule)
  minutes_spent INTEGER,
  units INTEGER NOT NULL DEFAULT 1,

  -- Modifiers
  modifier_1 TEXT,
  modifier_2 TEXT,

  -- Diagnosis pointers
  diagnosis_pointer INTEGER[] DEFAULT '{1}', -- links to ICD-10 order

  -- Billing
  charge_amount NUMERIC(10,2),
  date_of_service DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'denied', 'appealed')),

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charges_visit ON visit_charges(visit_id);
CREATE INDEX IF NOT EXISTS idx_charges_episode ON visit_charges(episode_id);
CREATE INDEX IF NOT EXISTS idx_charges_date ON visit_charges(date_of_service);
CREATE INDEX IF NOT EXISTS idx_charges_status ON visit_charges(status);

-- Prior authorization tracking
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  auth_number TEXT,
  insurance_name TEXT,
  insurance_phone TEXT,

  -- Visit limits
  authorized_visits INTEGER,
  used_visits INTEGER DEFAULT 0,
  remaining_visits INTEGER GENERATED ALWAYS AS (authorized_visits - used_visits) STORED,

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  requested_date DATE,
  approved_date DATE,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'exhausted')),
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_episode ON prior_authorizations(episode_id);
CREATE INDEX IF NOT EXISTS idx_auth_status ON prior_authorizations(status);

-- Patient payments (co-pay tracking)
CREATE TABLE IF NOT EXISTS patient_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,

  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT DEFAULT 'copay' CHECK (payment_type IN ('copay', 'coinsurance', 'deductible', 'self_pay', 'other')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'other')),
  reference_number TEXT,
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,

  collected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_patient ON patient_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON patient_payments(date_received);

-- ============================================================================
-- 5. CO-SIGNATURE WORKFLOW
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE cosign_status AS ENUM ('pending', 'signed', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Who signed
  signer_user_id UUID NOT NULL REFERENCES auth.users(id),
  signer_role TEXT NOT NULL, -- 'pt', 'pta', 'admin'
  signer_name TEXT NOT NULL,
  signer_credentials TEXT, -- "PT, DPT", "PTA"

  -- Signature details
  signature_type TEXT NOT NULL CHECK (signature_type IN ('author', 'cosigner', 'reviewer')),
  status cosign_status DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Electronic signature attestation
  attestation TEXT DEFAULT 'I attest that this document accurately reflects the services provided.',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatures_document ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signer ON document_signatures(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_status ON document_signatures(status) WHERE status = 'pending';

-- Track co-sign requirements
ALTER TABLE documents ADD COLUMN IF NOT EXISTS requires_cosign BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cosign_status cosign_status;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES auth.users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMPTZ;

-- ============================================================================
-- 6. EXERCISE LIBRARY & HEP
-- ============================================================================

CREATE TABLE IF NOT EXISTS exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE, -- NULL = global/system
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- "Stretching", "Strengthening", "Balance", "Cardio", etc.
  body_region TEXT, -- "Cervical", "Shoulder", "Lumbar", "Hip", "Knee", "Ankle", etc.
  difficulty TEXT DEFAULT 'moderate' CHECK (difficulty IN ('easy', 'moderate', 'hard', 'advanced')),
  equipment TEXT, -- "None", "Theraband", "Foam Roller", etc.

  -- Default prescription
  default_sets TEXT,
  default_reps TEXT,
  default_hold TEXT, -- e.g. "30 seconds"
  default_frequency TEXT, -- e.g. "2x daily"

  -- Instructions
  instructions TEXT,
  precautions TEXT,
  progression_notes TEXT,

  -- Media
  image_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercise_library(category);
CREATE INDEX IF NOT EXISTS idx_exercises_body_region ON exercise_library(body_region);
CREATE INDEX IF NOT EXISTS idx_exercises_clinic ON exercise_library(clinic_id);

-- HEP (Home Exercise Program) - assigned programs
CREATE TABLE IF NOT EXISTS hep_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  name TEXT NOT NULL DEFAULT 'Home Exercise Program',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'discontinued')),
  start_date DATE DEFAULT CURRENT_DATE,
  instructions TEXT, -- general program instructions
  frequency TEXT, -- e.g. "Daily", "3x per week"

  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hep_programs_patient ON hep_programs(patient_id);
CREATE INDEX IF NOT EXISTS idx_hep_programs_episode ON hep_programs(episode_id);

-- HEP program exercises (many-to-many with prescription details)
CREATE TABLE IF NOT EXISTS hep_program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hep_program_id UUID NOT NULL REFERENCES hep_programs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercise_library(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,

  -- Prescription (overrides exercise defaults)
  sets TEXT,
  reps TEXT,
  hold TEXT,
  frequency TEXT,
  special_instructions TEXT,

  -- Progression tracking
  date_added DATE DEFAULT CURRENT_DATE,
  date_progressed DATE,
  progression_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hep_exercises_program ON hep_program_exercises(hep_program_id);

-- ============================================================================
-- 7. REPORTING / ANALYTICS SUPPORT
-- ============================================================================

-- Referral source tracking (add to patients)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source TEXT; -- "Physician", "Self", "Insurance", "Marketing", "Other"
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source_detail TEXT; -- specific physician name, etc.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_carrier TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_plan TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_group TEXT;

-- Add productivity fields to visits
ALTER TABLE visits ADD COLUMN IF NOT EXISTS total_treatment_minutes INTEGER;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS total_units NUMERIC(4,1);

-- ============================================================================
-- 8. SECURE MESSAGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  thread_id UUID, -- group messages into threads

  -- Recipients (user IDs)
  recipient_ids UUID[] NOT NULL DEFAULT '{}',

  -- Content
  subject TEXT,
  body TEXT NOT NULL,
  is_urgent BOOLEAN DEFAULT FALSE,

  -- Related context
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_clinic ON messages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_patient ON messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);

-- ============================================================================
-- 9. AUDIT LOG (HIPAA COMPLIANCE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,

  -- What happened
  action TEXT NOT NULL, -- 'view', 'create', 'update', 'delete', 'export', 'print', 'sign', 'login', 'logout'
  resource_type TEXT NOT NULL, -- 'patient', 'document', 'episode', 'visit', etc.
  resource_id UUID,
  resource_description TEXT, -- human-readable e.g. "Patient: John Doe"

  -- Details
  changes JSONB, -- { field: { old, new } } for updates
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_clinic ON audit_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- 10. PROVIDER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  -- Professional info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  credentials TEXT, -- "PT, DPT", "PTA", etc.
  npi TEXT, -- National Provider Identifier
  license_number TEXT,
  license_state TEXT,
  license_expiry DATE,
  specialty TEXT, -- "Orthopedic", "Pediatric", "Neurological", etc.

  -- Contact
  email TEXT,
  phone TEXT,

  -- Scheduling
  default_appointment_duration INTEGER DEFAULT 45, -- minutes
  max_daily_patients INTEGER,
  color TEXT, -- for calendar display, hex color

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_profiles_user ON provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_clinic ON provider_profiles(clinic_id);

-- ============================================================================
-- 11. PLAN OF CARE CERTIFICATION
-- ============================================================================

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS poc_certified_date DATE;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS poc_certified_by UUID REFERENCES auth.users(id);
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS poc_recert_due_date DATE;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS authorized_visits INTEGER;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS visits_used INTEGER DEFAULT 0;

-- ============================================================================
-- 12. RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE therapist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_measure_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_measure_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpt_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE prior_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE hep_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hep_program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;

-- Permissive policies (to be tightened per clinic in production)
CREATE POLICY "therapist_availability_all" ON therapist_availability FOR ALL USING (true);
CREATE POLICY "waitlist_all" ON waitlist FOR ALL USING (true);
CREATE POLICY "outcome_definitions_all" ON outcome_measure_definitions FOR ALL USING (true);
CREATE POLICY "outcome_scores_all" ON outcome_measure_scores FOR ALL USING (true);
CREATE POLICY "goals_all" ON treatment_goals FOR ALL USING (true);
CREATE POLICY "goal_progress_all" ON goal_progress_notes FOR ALL USING (true);
CREATE POLICY "cpt_codes_all" ON cpt_codes FOR ALL USING (true);
CREATE POLICY "visit_charges_all" ON visit_charges FOR ALL USING (true);
CREATE POLICY "prior_auth_all" ON prior_authorizations FOR ALL USING (true);
CREATE POLICY "patient_payments_all" ON patient_payments FOR ALL USING (true);
CREATE POLICY "document_signatures_all" ON document_signatures FOR ALL USING (true);
CREATE POLICY "exercise_library_all" ON exercise_library FOR ALL USING (true);
CREATE POLICY "hep_programs_all" ON hep_programs FOR ALL USING (true);
CREATE POLICY "hep_exercises_all" ON hep_program_exercises FOR ALL USING (true);
CREATE POLICY "messages_all" ON messages FOR ALL USING (true);
CREATE POLICY "message_reads_all" ON message_reads FOR ALL USING (true);
CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (true);
CREATE POLICY "provider_profiles_all" ON provider_profiles FOR ALL USING (true);

-- ============================================================================
-- 13. UPDATED_AT TRIGGERS FOR NEW TABLES
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_therapist_avail_updated_at ON therapist_availability;
CREATE TRIGGER trigger_therapist_avail_updated_at
  BEFORE UPDATE ON therapist_availability FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_goals_updated_at ON treatment_goals;
CREATE TRIGGER trigger_goals_updated_at
  BEFORE UPDATE ON treatment_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_charges_updated_at ON visit_charges;
CREATE TRIGGER trigger_charges_updated_at
  BEFORE UPDATE ON visit_charges FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_auth_updated_at ON prior_authorizations;
CREATE TRIGGER trigger_auth_updated_at
  BEFORE UPDATE ON prior_authorizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_signatures_updated_at ON document_signatures;
CREATE TRIGGER trigger_signatures_updated_at
  BEFORE UPDATE ON document_signatures FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_exercise_library_updated_at ON exercise_library;
CREATE TRIGGER trigger_exercise_library_updated_at
  BEFORE UPDATE ON exercise_library FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_hep_programs_updated_at ON hep_programs;
CREATE TRIGGER trigger_hep_programs_updated_at
  BEFORE UPDATE ON hep_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_provider_profiles_updated_at ON provider_profiles;
CREATE TRIGGER trigger_provider_profiles_updated_at
  BEFORE UPDATE ON provider_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 14. SEED DATA: CPT CODES
-- ============================================================================

INSERT INTO cpt_codes (code, description, category, is_timed, unit_minutes) VALUES
  -- Evaluations (untimed)
  ('97161', 'PT Evaluation - Low Complexity', 'Evaluation', FALSE, NULL),
  ('97162', 'PT Evaluation - Moderate Complexity', 'Evaluation', FALSE, NULL),
  ('97163', 'PT Evaluation - High Complexity', 'Evaluation', FALSE, NULL),
  ('97164', 'PT Re-Evaluation', 'Re-Evaluation', FALSE, NULL),
  -- Timed codes
  ('97110', 'Therapeutic Exercise', 'Therapeutic Exercise', TRUE, 15),
  ('97112', 'Neuromuscular Re-education', 'Neuromuscular Re-education', TRUE, 15),
  ('97116', 'Gait Training', 'Gait Training', TRUE, 15),
  ('97140', 'Manual Therapy', 'Manual Therapy', TRUE, 15),
  ('97530', 'Therapeutic Activities', 'Therapeutic Activities', TRUE, 15),
  ('97535', 'Self-Care/Home Management Training', 'ADL Training', TRUE, 15),
  ('97542', 'Wheelchair Management', 'Wheelchair', TRUE, 15),
  ('97150', 'Group Therapy', 'Group Therapy', TRUE, 15),
  ('97032', 'Electrical Stimulation (attended)', 'Modalities', TRUE, 15),
  ('97033', 'Iontophoresis', 'Modalities', TRUE, 15),
  ('97035', 'Ultrasound', 'Modalities', TRUE, 15),
  -- Untimed codes
  ('97010', 'Hot/Cold Packs', 'Modalities', FALSE, NULL),
  ('97014', 'Electrical Stimulation (unattended)', 'Modalities', FALSE, NULL),
  ('97018', 'Paraffin Bath', 'Modalities', FALSE, NULL),
  ('97012', 'Mechanical Traction', 'Modalities', FALSE, NULL),
  ('97760', 'Orthotic Management - Training', 'Orthotics', TRUE, 15),
  ('97542', 'Wheelchair Assessment', 'Wheelchair', FALSE, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 15. SEED DATA: OUTCOME MEASURE DEFINITIONS
-- ============================================================================

INSERT INTO outcome_measure_definitions (name, abbreviation, description, category, min_score, max_score, mcid, higher_is_better, score_interpretation, questions) VALUES
(
  'Oswestry Disability Index',
  'ODI',
  'Measures disability in patients with low back pain. 10 sections scored 0-5.',
  'Spine',
  0, 100, 6, FALSE,
  '{"ranges": [{"min":0,"max":20,"label":"Minimal disability"},{"min":21,"max":40,"label":"Moderate disability"},{"min":41,"max":60,"label":"Severe disability"},{"min":61,"max":80,"label":"Crippling disability"},{"min":81,"max":100,"label":"Bed-bound or exaggerating"}]}',
  '[{"id":"pain_intensity","text":"Pain Intensity","options":[{"value":0,"label":"No pain at the moment"},{"value":1,"label":"Very mild pain at the moment"},{"value":2,"label":"Moderate pain at the moment"},{"value":3,"label":"Fairly severe pain at the moment"},{"value":4,"label":"Very severe pain at the moment"},{"value":5,"label":"Worst imaginable pain"}]},{"id":"personal_care","text":"Personal Care (Washing, Dressing)","options":[{"value":0,"label":"No difficulty"},{"value":1,"label":"Can manage but causes extra pain"},{"value":2,"label":"Painful, careful and slow"},{"value":3,"label":"Need some help, manage most"},{"value":4,"label":"Need help every day in most aspects"},{"value":5,"label":"Cannot dress, wash with difficulty"}]},{"id":"lifting","text":"Lifting","options":[{"value":0,"label":"Can lift heavy weights without extra pain"},{"value":1,"label":"Can lift heavy weights but causes extra pain"},{"value":2,"label":"Pain prevents lifting heavy weights off floor"},{"value":3,"label":"Pain prevents lifting heavy weights, can manage light-medium if conveniently positioned"},{"value":4,"label":"Can lift only very light weights"},{"value":5,"label":"Cannot lift or carry anything at all"}]},{"id":"walking","text":"Walking","options":[{"value":0,"label":"No pain on walking any distance"},{"value":1,"label":"Pain on walking more than 1 mile"},{"value":2,"label":"Pain on walking more than 1/2 mile"},{"value":3,"label":"Pain on walking more than 100 yards"},{"value":4,"label":"Can only walk using stick or crutches"},{"value":5,"label":"In bed most of the time"}]},{"id":"sitting","text":"Sitting","options":[{"value":0,"label":"Can sit in any chair as long as I like"},{"value":1,"label":"Can only sit in favorite chair as long as I like"},{"value":2,"label":"Pain prevents sitting more than 1 hour"},{"value":3,"label":"Pain prevents sitting more than 30 minutes"},{"value":4,"label":"Pain prevents sitting more than 10 minutes"},{"value":5,"label":"Pain prevents sitting at all"}]},{"id":"standing","text":"Standing","options":[{"value":0,"label":"Can stand as long as I want without extra pain"},{"value":1,"label":"Can stand as long as I want but gives extra pain"},{"value":2,"label":"Pain prevents standing more than 1 hour"},{"value":3,"label":"Pain prevents standing more than 30 minutes"},{"value":4,"label":"Pain prevents standing more than 10 minutes"},{"value":5,"label":"Pain prevents standing at all"}]},{"id":"sleeping","text":"Sleeping","options":[{"value":0,"label":"Not disturbed by pain"},{"value":1,"label":"Occasionally disturbed by pain"},{"value":2,"label":"Less than 6 hours sleep because of pain"},{"value":3,"label":"Less than 4 hours sleep because of pain"},{"value":4,"label":"Less than 2 hours sleep because of pain"},{"value":5,"label":"Pain prevents any sleep at all"}]},{"id":"social_life","text":"Social Life","options":[{"value":0,"label":"Normal, no extra pain"},{"value":1,"label":"Normal but increases pain"},{"value":2,"label":"No significant effect on social life apart from limiting energetic interests"},{"value":3,"label":"Pain has restricted social life to home"},{"value":4,"label":"Pain has restricted social life, go out rarely"},{"value":5,"label":"No social life because of pain"}]},{"id":"travelling","text":"Travelling","options":[{"value":0,"label":"Can travel anywhere without pain"},{"value":1,"label":"Can travel anywhere but gives extra pain"},{"value":2,"label":"Pain is bad but manage trips over 2 hours"},{"value":3,"label":"Pain restricts travel to less than 1 hour"},{"value":4,"label":"Pain restricts travel to short necessary journeys under 30 minutes"},{"value":5,"label":"Pain prevents travel except to receive treatment"}]},{"id":"employment","text":"Employment/Homemaking","options":[{"value":0,"label":"Normal activities do not cause extra pain"},{"value":1,"label":"Normal activities increase pain but can still perform all"},{"value":2,"label":"Can do most but pain prevents more physically stressful activities"},{"value":3,"label":"Pain prevents anything but light duties"},{"value":4,"label":"Pain prevents most duties"},{"value":5,"label":"Pain prevents any duties at all"}]}]'
),
(
  'Neck Disability Index',
  'NDI',
  'Measures self-rated disability in patients with neck pain. 10 sections scored 0-5.',
  'Spine',
  0, 100, 5, FALSE,
  '{"ranges": [{"min":0,"max":8,"label":"No disability"},{"min":9,"max":28,"label":"Mild disability"},{"min":29,"max":48,"label":"Moderate disability"},{"min":49,"max":68,"label":"Severe disability"},{"min":69,"max":100,"label":"Complete disability"}]}',
  '[]'
),
(
  'Lower Extremity Functional Scale',
  'LEFS',
  'Measures functional status for patients with lower extremity conditions. 20 items scored 0-4.',
  'Lower Extremity',
  0, 80, 9, TRUE,
  '{"ranges": [{"min":0,"max":19,"label":"Extreme difficulty"},{"min":20,"max":39,"label":"Quite a bit of difficulty"},{"min":40,"max":59,"label":"Moderate difficulty"},{"min":60,"max":79,"label":"Mild difficulty"},{"min":80,"max":80,"label":"No difficulty"}]}',
  '[]'
),
(
  'QuickDASH',
  'QuickDASH',
  'Shortened version of the DASH outcome measure for upper extremity. 11 items.',
  'Upper Extremity',
  0, 100, 8, FALSE,
  '{"ranges": [{"min":0,"max":25,"label":"Mild disability"},{"min":26,"max":50,"label":"Moderate disability"},{"min":51,"max":75,"label":"Severe disability"},{"min":76,"max":100,"label":"Extreme disability"}]}',
  '[]'
),
(
  'Timed Up and Go',
  'TUG',
  'Measures time to rise from a chair, walk 3 meters, turn, walk back, and sit down.',
  'Balance',
  0, 999, 3.4, FALSE,
  '{"ranges": [{"min":0,"max":10,"label":"Normal mobility"},{"min":10,"max":20,"label":"Mostly independent"},{"min":20,"max":30,"label":"Variable mobility, may need assistive device"},{"min":30,"max":999,"label":"Impaired mobility, likely needs assistive device"}]}',
  '[]'
),
(
  'Berg Balance Scale',
  'BBS',
  'Measures static and dynamic balance. 14 items scored 0-4.',
  'Balance',
  0, 56, 4, TRUE,
  '{"ranges": [{"min":0,"max":20,"label":"High fall risk - wheelchair bound"},{"min":21,"max":40,"label":"Medium fall risk - walking with assistance"},{"min":41,"max":56,"label":"Low fall risk - independent"}]}',
  '[]'
),
(
  'Numeric Pain Rating Scale',
  'NPRS',
  'Self-reported pain intensity on 0-10 scale.',
  'General',
  0, 10, 2, FALSE,
  '{"ranges": [{"min":0,"max":0,"label":"No pain"},{"min":1,"max":3,"label":"Mild pain"},{"min":4,"max":6,"label":"Moderate pain"},{"min":7,"max":10,"label":"Severe pain"}]}',
  '[]'
),
(
  'Patient-Specific Functional Scale',
  'PSFS',
  'Patient identifies activities they have difficulty with and rates on 0-10 scale.',
  'General',
  0, 10, 2, TRUE,
  '{"ranges": [{"min":0,"max":3,"label":"Severe functional limitation"},{"min":4,"max":6,"label":"Moderate functional limitation"},{"min":7,"max":10,"label":"Minimal functional limitation"}]}',
  '[]'
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 16. SEED DATA: EXERCISE LIBRARY (system-wide, clinic_id = NULL)
-- ============================================================================

INSERT INTO exercise_library (clinic_id, name, description, category, body_region, difficulty, equipment, default_sets, default_reps, default_hold, default_frequency, instructions) VALUES
  (NULL, 'Cervical Retraction (Chin Tucks)', 'Gently draw chin straight back, creating a double chin. Hold.', 'Stretching', 'Cervical', 'easy', 'None', '3', '10', '5 seconds', '2x daily', 'Sit or stand tall. Pull chin straight back without tilting head up or down. Hold, then relax.'),
  (NULL, 'Upper Trap Stretch', 'Lateral neck flexion stretch for upper trapezius.', 'Stretching', 'Cervical', 'easy', 'None', '3', '3', '30 seconds', '2x daily', 'Sit tall, gently tilt ear toward shoulder. Use hand for gentle overpressure. Keep opposite shoulder down.'),
  (NULL, 'Shoulder Pendulums', 'Gentle pendulum swings for shoulder mobility.', 'Range of Motion', 'Shoulder', 'easy', 'None', '3', '10 each direction', NULL, '3x daily', 'Lean forward supported. Let arm hang. Gently swing in circles, side to side, and forward/back.'),
  (NULL, 'Shoulder External Rotation with Band', 'Resisted external rotation with theraband.', 'Strengthening', 'Shoulder', 'moderate', 'Theraband', '3', '10', NULL, 'Daily', 'Stand with elbow at side, bent 90 degrees. Hold band. Rotate forearm outward. Slowly return.'),
  (NULL, 'Pelvic Tilts', 'Gentle lumbar stabilization exercise.', 'Stabilization', 'Lumbar', 'easy', 'None', '3', '10', '5 seconds', '2x daily', 'Lie on back with knees bent. Flatten low back against floor by tightening abs. Hold, then relax.'),
  (NULL, 'Bridging', 'Gluteal and core strengthening.', 'Strengthening', 'Lumbar', 'easy', 'None', '3', '10', '5 seconds', 'Daily', 'Lie on back, knees bent. Squeeze glutes and lift hips off floor. Hold at top, then slowly lower.'),
  (NULL, 'Bird Dog', 'Core stabilization with alternating arm/leg extension.', 'Stabilization', 'Lumbar', 'moderate', 'None', '3', '10 each side', '5 seconds', 'Daily', 'On hands and knees. Extend opposite arm and leg. Keep core tight and back flat. Hold, return, alternate.'),
  (NULL, 'Prone Press-Ups (McKenzie)', 'Lumbar extension exercise.', 'Range of Motion', 'Lumbar', 'easy', 'None', '3', '10', NULL, 'Every 2 hours', 'Lie face down. Press up on hands, keeping hips on surface. Straighten arms as tolerated. Let back sag.'),
  (NULL, 'Clamshells', 'Hip external rotator strengthening.', 'Strengthening', 'Hip', 'easy', 'None', '3', '15', NULL, 'Daily', 'Lie on side, knees bent. Keep feet together, open top knee like a clamshell. Do not rotate trunk.'),
  (NULL, 'Standing Hip Abduction', 'Hip abductor strengthening.', 'Strengthening', 'Hip', 'moderate', 'Theraband', '3', '10', NULL, 'Daily', 'Stand tall holding support. Lift leg out to side keeping toes forward. Slowly return. Keep trunk upright.'),
  (NULL, 'Quad Sets', 'Isometric quadriceps activation.', 'Strengthening', 'Knee', 'easy', 'None', '3', '10', '5 seconds', '3x daily', 'Sit or lie with leg straight. Tighten thigh muscle, pressing back of knee down. Hold, then relax.'),
  (NULL, 'Straight Leg Raises', 'Quadriceps strengthening with leg straight.', 'Strengthening', 'Knee', 'easy', 'None', '3', '10', NULL, 'Daily', 'Lie on back. Tighten quad, then lift straight leg to 45 degrees. Hold briefly, slowly lower.'),
  (NULL, 'Terminal Knee Extension', 'Strengthening last degrees of knee extension.', 'Strengthening', 'Knee', 'moderate', 'Theraband', '3', '10', '3 seconds', 'Daily', 'Place roll under knee. Straighten knee fully against resistance. Hold at full extension, slowly return.'),
  (NULL, 'Heel Raises', 'Calf strengthening (gastrocnemius).', 'Strengthening', 'Ankle', 'easy', 'None', '3', '15', NULL, 'Daily', 'Stand holding support. Rise up on toes as high as possible. Slowly lower back down.'),
  (NULL, 'Ankle Alphabet', 'Ankle mobility exercise tracing letters.', 'Range of Motion', 'Ankle', 'easy', 'None', '2', 'Full alphabet', NULL, '2x daily', 'Sit with foot off ground. Trace each letter of the alphabet with your big toe.'),
  (NULL, 'Single Leg Balance', 'Static balance training.', 'Balance', 'Lower Extremity', 'moderate', 'None', '3', '3', '30 seconds', 'Daily', 'Stand on one leg near support. Maintain balance. Progress by closing eyes or standing on foam.'),
  (NULL, 'Tandem Walking', 'Dynamic balance heel-to-toe walking.', 'Balance', 'Lower Extremity', 'moderate', 'None', '3', '20 steps', NULL, 'Daily', 'Walk in a straight line placing heel directly in front of opposite toe. Use wall for safety if needed.'),
  (NULL, 'Hamstring Stretch (Supine)', 'Hamstring flexibility.', 'Stretching', 'Lower Extremity', 'easy', 'Towel/Strap', '3', '3', '30 seconds', '2x daily', 'Lie on back. Loop towel around foot and straighten leg toward ceiling. Keep opposite leg flat.'),
  (NULL, 'Piriformis Stretch', 'Stretch for piriformis and deep hip rotators.', 'Stretching', 'Hip', 'easy', 'None', '3', '3', '30 seconds', '2x daily', 'Lie on back. Cross ankle over opposite knee. Pull bottom thigh toward chest. Feel stretch in buttock.'),
  (NULL, 'Wall Slides (Squats)', 'Functional quad strengthening.', 'Strengthening', 'Lower Extremity', 'moderate', 'None', '3', '10', '5 seconds', 'Daily', 'Lean against wall, feet shoulder-width apart and 2 feet from wall. Slide down to 45-60 degree knee bend. Hold, slide back up.')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 17. COMMENTS
-- ============================================================================

COMMENT ON TABLE therapist_availability IS 'Provider schedule blocks and availability';
COMMENT ON TABLE waitlist IS 'Patient waitlist for cancelled or open appointment slots';
COMMENT ON TABLE outcome_measure_definitions IS 'Standardized outcome measure templates (ODI, NDI, LEFS, etc.)';
COMMENT ON TABLE outcome_measure_scores IS 'Patient outcome measure scores over time';
COMMENT ON TABLE treatment_goals IS 'STG/LTG structured treatment goals';
COMMENT ON TABLE goal_progress_notes IS 'Progress history for treatment goals';
COMMENT ON TABLE cpt_codes IS 'CPT/HCPCS code reference table';
COMMENT ON TABLE visit_charges IS 'Billing charge capture per visit (superbill line items)';
COMMENT ON TABLE prior_authorizations IS 'Insurance prior authorization tracking';
COMMENT ON TABLE patient_payments IS 'Patient payment collection tracking';
COMMENT ON TABLE document_signatures IS 'Electronic signatures and co-sign workflow';
COMMENT ON TABLE exercise_library IS 'Exercise database for HEP programs';
COMMENT ON TABLE hep_programs IS 'Home exercise programs assigned to patients';
COMMENT ON TABLE hep_program_exercises IS 'Individual exercises within a HEP';
COMMENT ON TABLE messages IS 'Secure internal clinic messaging';
COMMENT ON TABLE message_reads IS 'Message read receipts';
COMMENT ON TABLE audit_log IS 'HIPAA-compliant access and change audit trail';
COMMENT ON TABLE provider_profiles IS 'Provider professional profiles (NPI, license, etc.)';
