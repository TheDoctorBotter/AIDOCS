/**
 * PDF Template Engine
 *
 * Handles:
 * - Extracting text from uploaded PDFs to detect section headers
 * - Detecting existing AcroForm fields
 * - Filling PDF templates with note data (text overlay on fixed positions)
 * - Generating filled PDF buffers for download
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { NoteTemplateData, PdfFormField, PlaceholderSource } from './types';

// ============================================================================
// Types
// ============================================================================

interface PdfFillOptions {
  templateBuffer: ArrayBuffer;
  fields: PdfFormField[];
  data: NoteTemplateData;
}

interface PdfFillResult {
  success: boolean;
  buffer?: ArrayBuffer;
  error?: string;
}

interface DetectedSection {
  label: string;
  pageNumber: number;
  y: number;
}

interface PdfInfo {
  numPages: number;
  hasFormFields: boolean;
  formFieldNames: string[];
  detectedSections: DetectedSection[];
  pageWidths: number[];
  pageHeights: number[];
}

// ============================================================================
// Common PT note section headers to detect in PDFs
// ============================================================================

const SECTION_PATTERNS: Array<{ pattern: RegExp; label: string; source: PlaceholderSource }> = [
  { pattern: /\bsubjective\b/i, label: 'Subjective', source: 'subjective' },
  { pattern: /\bobjective\b/i, label: 'Objective', source: 'objective' },
  { pattern: /\bassessment\b/i, label: 'Assessment', source: 'assessment' },
  { pattern: /\bplan\b/i, label: 'Plan', source: 'plan' },
  { pattern: /\bpatient\s*name\b/i, label: 'Patient Name', source: 'patientName' },
  { pattern: /\bdate\s*of\s*(birth|DOB)\b/i, label: 'Date of Birth', source: 'dob' },
  { pattern: /\bdate\s*of\s*service\b/i, label: 'Date of Service', source: 'dateOfService' },
  { pattern: /\bdiagnosis|dx\b/i, label: 'Diagnosis', source: 'medicalDx' },
  { pattern: /\breferring\s*(md|physician|doctor)\b/i, label: 'Referring MD', source: 'referringMd' },
  { pattern: /\binsurance\b/i, label: 'Insurance ID', source: 'insuranceId' },
  { pattern: /\bgoals?\b/i, label: 'Goals', source: 'shortTermGoals' },
  { pattern: /\bshort\s*term\s*goals?\b/i, label: 'Short Term Goals', source: 'shortTermGoals' },
  { pattern: /\blong\s*term\s*goals?\b/i, label: 'Long Term Goals', source: 'longTermGoals' },
  { pattern: /\bfrequency\b/i, label: 'Frequency', source: 'frequency' },
  { pattern: /\bprognosis\b/i, label: 'Prognosis', source: 'prognosis' },
  { pattern: /\bhome\s*exercise|HEP\b/i, label: 'Home Exercise Program', source: 'hep' },
  { pattern: /\ballergies\b/i, label: 'Allergies', source: 'allergies' },
  { pattern: /\bprecautions\b/i, label: 'Precautions', source: 'precautions' },
  { pattern: /\btherapist\s*name|provider\b/i, label: 'Therapist Name', source: 'therapistName' },
  { pattern: /\bsignature\b/i, label: 'Signature Date', source: 'signatureDate' },
  { pattern: /\bbilling|cpt\b/i, label: 'CPT Codes', source: 'cptCodes' },
  { pattern: /\bhistory\b/i, label: 'Patient History', source: 'patientHistory' },
];

// ============================================================================
// PDF Analysis
// ============================================================================

/**
 * Analyze a PDF to extract metadata, detect form fields, and identify
 * clinical note section headers from the text content.
 */
export async function analyzePdf(pdfBuffer: ArrayBuffer): Promise<PdfInfo> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // Get page dimensions
  const pageWidths = pages.map((p) => p.getWidth());
  const pageHeights = pages.map((p) => p.getHeight());

  // Check for existing AcroForm fields
  const form = pdfDoc.getForm();
  const formFields = form.getFields();
  const formFieldNames = formFields.map((f) => f.getName());

  // Detect sections from form field names
  const detectedSections: DetectedSection[] = [];
  const seenLabels = new Set<string>();

  // Map form field names to known sections
  for (const fieldName of formFieldNames) {
    for (const sp of SECTION_PATTERNS) {
      if (sp.pattern.test(fieldName) && !seenLabels.has(sp.label)) {
        seenLabels.add(sp.label);
        detectedSections.push({
          label: sp.label,
          pageNumber: 1,
          y: 0,
        });
      }
    }
  }

  return {
    numPages: pages.length,
    hasFormFields: formFieldNames.length > 0,
    formFieldNames,
    detectedSections,
    pageWidths,
    pageHeights,
  };
}

/**
 * Detect existing AcroForm fields and return them as PdfFormField-compatible
 * objects. If the PDF has fillable fields, we can map them directly.
 */
export async function detectAcroFormFields(
  pdfBuffer: ArrayBuffer
): Promise<Array<Partial<PdfFormField>>> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const result: Array<Partial<PdfFormField>> = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const name = field.getName();
    const widgets = field.acroField.getWidgets();

    // Try to get widget position
    let pageNumber = 1;
    let x = 0;
    let y = 0;
    let width = 200;
    let height = 20;

    if (widgets.length > 0) {
      const rect = widgets[0].getRectangle();
      x = rect.x;
      y = rect.y;
      width = rect.width;
      height = rect.height;

      // Find which page this widget is on
      const pages = pdfDoc.getPages();
      for (let p = 0; p < pages.length; p++) {
        const pageRef = pages[p].ref;
        const widgetPage = widgets[0].P();
        if (widgetPage && pageRef === widgetPage) {
          pageNumber = p + 1;
          break;
        }
      }
    }

    // Try to match to a known placeholder source
    let placeholderSource: PlaceholderSource | undefined;
    for (const sp of SECTION_PATTERNS) {
      if (sp.pattern.test(name)) {
        placeholderSource = sp.source;
        break;
      }
    }

    result.push({
      field_name: name,
      field_label: name.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
      field_type: height > 40 ? 'textarea' : 'text',
      page_number: pageNumber,
      x_coordinate: x,
      y_coordinate: y,
      width,
      height,
      placeholder_source: placeholderSource,
      sort_order: i,
      is_required: false,
      font_size: 10,
      font_name: 'Helvetica',
    });
  }

  return result;
}

// ============================================================================
// Data Mapping
// ============================================================================

/**
 * Get the value for a placeholder source from NoteTemplateData
 */
function getValueForSource(data: NoteTemplateData, source: PlaceholderSource): string {
  const value = data[source as keyof NoteTemplateData];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    // Handle goals array
    return value.map((g) => (typeof g === 'string' ? g : g.text)).join('\n');
  }
  return String(value);
}

// ============================================================================
// PDF Filling — AcroForm method
// ============================================================================

/**
 * Fill existing AcroForm fields in a PDF with note data
 */
async function fillAcroFormFields(
  pdfDoc: PDFDocument,
  fields: PdfFormField[],
  data: NoteTemplateData
): Promise<void> {
  const form = pdfDoc.getForm();

  for (const field of fields) {
    const value = getValueForSource(data, field.placeholder_source);
    if (!value) continue;

    try {
      // Try to find the AcroForm field by name
      const acroField = form.getTextField(field.field_name);
      if (acroField) {
        acroField.setText(value);
      }
    } catch {
      // Field might not exist or might not be a text field
      // Fall through to text overlay method
    }
  }
}

// ============================================================================
// PDF Filling — Text Overlay method
// ============================================================================

/**
 * Draw text onto a PDF page at the specified coordinates.
 * Handles multi-line text for textarea fields.
 */
function drawFieldText(
  page: PDFPage,
  field: PdfFormField,
  value: string,
  font: PDFFont,
  pageHeight: number
) {
  const fontSize = field.font_size || 10;
  const lineHeight = fontSize * 1.2;

  if (field.field_type === 'textarea') {
    // Multi-line: wrap text within field width
    const maxCharsPerLine = Math.floor(field.width / (fontSize * 0.55));
    const lines = wrapText(value, maxCharsPerLine);
    const maxLines = Math.floor(field.height / lineHeight);

    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      page.drawText(lines[i], {
        x: field.x_coordinate,
        y: pageHeight - field.y_coordinate - (i + 1) * lineHeight,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  } else if (field.field_type === 'checkbox') {
    // Draw a checkmark or X if value is truthy
    if (value && value !== 'false' && value !== '0') {
      page.drawText('X', {
        x: field.x_coordinate + 2,
        y: pageHeight - field.y_coordinate - fontSize,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  } else {
    // Single-line text
    const truncated = value.length > Math.floor(field.width / (fontSize * 0.55))
      ? value.substring(0, Math.floor(field.width / (fontSize * 0.55))) + '...'
      : value;

    page.drawText(truncated, {
      x: field.x_coordinate,
      y: pageHeight - field.y_coordinate - fontSize,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }
}

/**
 * Wrap text to fit within a maximum character width
 */
function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      lines.push(paragraph);
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length > maxChars) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

// ============================================================================
// Core Fill Function
// ============================================================================

/**
 * Fill a PDF template with note data using mapped fields.
 *
 * Strategy:
 * 1. If the PDF has AcroForm fields matching our field names, fill those
 * 2. Always also draw text overlay at the mapped coordinates
 * 3. Flatten the form so the result is a static PDF
 */
export async function fillPdfTemplate(options: PdfFillOptions): Promise<PdfFillResult> {
  const { templateBuffer, fields, data } = options;

  if (!fields || fields.length === 0) {
    return { success: false, error: 'No fields mapped for this template' };
  }

  try {
    const pdfDoc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Try filling AcroForm fields first
    try {
      await fillAcroFormFields(pdfDoc, fields, data);
    } catch {
      // If AcroForm filling fails, we'll rely on text overlay
    }

    // Draw text overlay for all fields
    for (const field of fields) {
      const value = getValueForSource(data, field.placeholder_source);
      if (!value) continue;

      const pageIndex = (field.page_number || 1) - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const pageHeight = page.getHeight();

      drawFieldText(page, field, value, font, pageHeight);
    }

    // Flatten form so fields become static text
    try {
      const form = pdfDoc.getForm();
      form.flatten();
    } catch {
      // No form to flatten, that's fine
    }

    const outputBytes = await pdfDoc.save();
    return {
      success: true,
      buffer: outputBytes.buffer as ArrayBuffer,
    };
  } catch (error) {
    console.error('Error filling PDF template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error filling PDF',
    };
  }
}

// ============================================================================
// Default Field Generation
// ============================================================================

/**
 * Generate a set of default fields for a given note type.
 * This creates a reasonable layout that the user can adjust.
 */
export function generateDefaultFields(
  noteType: string,
  pageWidth: number,
  pageHeight: number
): Array<Omit<PdfFormField, 'id' | 'template_id' | 'created_at'>> {
  const margin = 50;
  const fieldWidth = pageWidth - 2 * margin;
  const smallFieldWidth = (fieldWidth - 20) / 2;
  const labelHeight = 18;
  const textareaHeight = 100;
  let currentY = 80;

  const fields: Array<Omit<PdfFormField, 'id' | 'template_id' | 'created_at'>> = [];
  let sortOrder = 0;

  const addField = (
    label: string,
    source: PlaceholderSource,
    type: PdfFormField['field_type'] = 'text',
    opts?: { width?: number; height?: number; x?: number }
  ) => {
    fields.push({
      field_name: source,
      field_label: label,
      field_type: type,
      page_number: 1,
      x_coordinate: opts?.x ?? margin,
      y_coordinate: currentY,
      width: opts?.width ?? fieldWidth,
      height: opts?.height ?? labelHeight,
      placeholder_source: source,
      sort_order: sortOrder++,
      is_required: false,
      font_size: 10,
      font_name: 'Helvetica',
    });
    currentY += (opts?.height ?? labelHeight) + 8;
  };

  // Common header fields
  addField('Patient Name', 'patientName', 'text', { width: smallFieldWidth });
  currentY -= labelHeight + 8; // same row
  addField('Date of Service', 'dateOfService', 'date', {
    width: smallFieldWidth,
    x: margin + smallFieldWidth + 20,
  });

  addField('Date of Birth', 'dob', 'date', { width: smallFieldWidth });
  currentY -= labelHeight + 8;
  addField('Insurance ID', 'insuranceId', 'text', {
    width: smallFieldWidth,
    x: margin + smallFieldWidth + 20,
  });

  addField('Medical Diagnosis', 'medicalDx');
  addField('Referring MD', 'referringMd');

  // Note-type-specific fields
  if (noteType === 'INITIAL_EVAL' || noteType === 'RE_EVAL') {
    addField('Patient History', 'patientHistory', 'textarea', { height: textareaHeight });
  }

  // SOAP sections (all note types)
  addField('Subjective', 'subjective', 'textarea', { height: textareaHeight });
  addField('Objective', 'objective', 'textarea', { height: textareaHeight });
  addField('Assessment', 'assessment', 'textarea', { height: textareaHeight });
  addField('Plan', 'plan', 'textarea', { height: textareaHeight });

  // Goals (eval types)
  if (noteType === 'INITIAL_EVAL' || noteType === 'RE_EVAL') {
    addField('Short Term Goals', 'shortTermGoals', 'textarea', { height: 60 });
    addField('Long Term Goals', 'longTermGoals', 'textarea', { height: 60 });
    addField('Prognosis', 'prognosis');
    addField('Frequency/Duration', 'frequency');
  }

  // Discharge-specific
  if (noteType === 'DISCHARGE') {
    addField('Short Term Goals', 'shortTermGoals', 'textarea', { height: 60 });
    addField('Long Term Goals', 'longTermGoals', 'textarea', { height: 60 });
    addField('Home Exercise Program', 'hep', 'textarea', { height: 60 });
  }

  // Common footer
  addField('Therapist Name', 'therapistName', 'text', { width: smallFieldWidth });
  currentY -= labelHeight + 8;
  addField('Signature Date', 'signatureDate', 'date', {
    width: smallFieldWidth,
    x: margin + smallFieldWidth + 20,
  });

  addField('Therapist Credentials', 'therapistCredentials');

  return fields;
}
