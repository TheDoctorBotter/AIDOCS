-- ============================================================================
-- PDF TEMPLATE SUPPORT
-- Enables uploading PDF note templates, detecting/mapping fillable sections,
-- and generating filled PDF documents for:
--   DAILY_NOTE, INITIAL_EVAL, RE_EVAL, DISCHARGE, PROGRESS_NOTE
--
-- Additive migration: no existing tables/columns/policies are changed.
-- ============================================================================

-- ============================================================================
-- 1. PDF FORM TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pdf_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name TEXT NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('DAILY_NOTE', 'INITIAL_EVAL', 'RE_EVAL', 'DISCHARGE', 'PROGRESS_NOTE')),
  template_name TEXT NOT NULL,
  description TEXT,
  file_key TEXT NOT NULL,       -- Storage path in Supabase Storage
  file_name TEXT NOT NULL,      -- Original uploaded filename
  file_size INTEGER NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  num_pages INTEGER,
  -- AI-detected sections stored for reference
  detected_sections JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_templates_clinic ON pdf_form_templates(clinic_name);
CREATE INDEX IF NOT EXISTS idx_pdf_templates_note_type ON pdf_form_templates(note_type);

COMMENT ON TABLE pdf_form_templates IS 'Uploaded PDF note templates with detected fillable sections';

-- ============================================================================
-- 2. PDF FORM FIELDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pdf_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES pdf_form_templates(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,                -- Internal identifier e.g. "subjective_text"
  field_label TEXT NOT NULL,               -- Display label e.g. "Subjective"
  field_type TEXT NOT NULL DEFAULT 'text'  -- text, textarea, checkbox, date, signature
    CHECK (field_type IN ('text', 'textarea', 'checkbox', 'date', 'signature')),
  page_number INTEGER NOT NULL DEFAULT 1,

  -- Position on the PDF page (PDF coordinate system)
  x_coordinate FLOAT NOT NULL DEFAULT 0,
  y_coordinate FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 200,
  height FLOAT NOT NULL DEFAULT 20,

  -- Maps this field to a NoteTemplateData property
  placeholder_source TEXT NOT NULL,        -- e.g. "subjective", "patientName", "dateOfService"
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,

  -- Appearance
  font_size FLOAT DEFAULT 10,
  font_name TEXT DEFAULT 'Helvetica',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_fields_template ON pdf_form_fields(template_id);

COMMENT ON TABLE pdf_form_fields IS 'Individual fillable fields mapped onto PDF templates';

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE pdf_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_form_fields ENABLE ROW LEVEL SECURITY;

-- Permissive policies (matches pattern in existing template system)
CREATE POLICY "pdf_templates_all" ON pdf_form_templates FOR ALL USING (true);
CREATE POLICY "pdf_fields_all" ON pdf_form_fields FOR ALL USING (true);

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_pdf_templates_updated_at ON pdf_form_templates;
CREATE TRIGGER trigger_pdf_templates_updated_at
  BEFORE UPDATE ON pdf_form_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON COLUMN pdf_form_templates.detected_sections IS 'AI-detected sections from the uploaded PDF (JSON array of {label, pageNumber, y})';
COMMENT ON COLUMN pdf_form_fields.placeholder_source IS 'Maps to NoteTemplateData property name (e.g. subjective, patientName, dateOfService)';
