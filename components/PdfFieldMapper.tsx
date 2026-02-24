'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  GripVertical,
  FileText,
} from 'lucide-react';
import {
  PdfFormTemplate,
  PdfFormField,
  PdfFieldType,
  PlaceholderSource,
  PDF_PLACEHOLDER_SOURCES,
  DOCUMENT_NOTE_TYPE_LABELS,
} from '@/lib/templates/types';

interface PdfFieldMapperProps {
  template: PdfFormTemplate;
  onSave: () => void;
}

const FIELD_TYPE_OPTIONS: Array<{ value: PdfFieldType; label: string }> = [
  { value: 'text', label: 'Single-Line Text' },
  { value: 'textarea', label: 'Multi-Line Text' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'signature', label: 'Signature' },
];

// Group placeholder sources for easier selection
const PLACEHOLDER_GROUPS: Array<{
  label: string;
  sources: Array<{ key: PlaceholderSource; label: string }>;
}> = [
  {
    label: 'Patient Info',
    sources: [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'patientFirstName', label: 'First Name' },
      { key: 'patientLastName', label: 'Last Name' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'age', label: 'Age' },
      { key: 'insuranceId', label: 'Insurance ID' },
      { key: 'referringMd', label: 'Referring MD' },
      { key: 'medicalDx', label: 'Medical Diagnosis' },
      { key: 'treatmentDx', label: 'Treatment Diagnosis' },
      { key: 'allergies', label: 'Allergies' },
      { key: 'precautions', label: 'Precautions' },
      { key: 'startOfCare', label: 'Start of Care' },
      { key: 'language', label: 'Language' },
    ],
  },
  {
    label: 'Session Info',
    sources: [
      { key: 'dateOfService', label: 'Date of Service' },
      { key: 'timeIn', label: 'Time In' },
      { key: 'timeOut', label: 'Time Out' },
      { key: 'totalTime', label: 'Total Time' },
      { key: 'units', label: 'Billable Units' },
    ],
  },
  {
    label: 'SOAP Sections',
    sources: [
      { key: 'subjective', label: 'Subjective' },
      { key: 'objective', label: 'Objective' },
      { key: 'assessment', label: 'Assessment' },
      { key: 'plan', label: 'Plan' },
      { key: 'patientHistory', label: 'Patient History' },
    ],
  },
  {
    label: 'Goals & Plan',
    sources: [
      { key: 'shortTermGoals', label: 'Short Term Goals' },
      { key: 'longTermGoals', label: 'Long Term Goals' },
      { key: 'prognosis', label: 'Prognosis' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'duration', label: 'Duration' },
      { key: 'hep', label: 'Home Exercise Program' },
    ],
  },
  {
    label: 'Billing',
    sources: [
      { key: 'dxCodes', label: 'Diagnosis Codes' },
      { key: 'cptCodes', label: 'CPT Codes' },
      { key: 'billingJustification', label: 'Billing Justification' },
    ],
  },
  {
    label: 'Provider',
    sources: [
      { key: 'therapistName', label: 'Therapist Name' },
      { key: 'therapistCredentials', label: 'Credentials' },
      { key: 'therapistLicense', label: 'License #' },
      { key: 'signatureDate', label: 'Signature Date' },
      { key: 'supervisingPtName', label: 'Supervising PT' },
    ],
  },
  {
    label: 'Clinic',
    sources: [
      { key: 'clinicName', label: 'Clinic Name' },
      { key: 'clinicAddress', label: 'Clinic Address' },
      { key: 'clinicPhone', label: 'Clinic Phone' },
    ],
  },
];

interface EditableField {
  id?: string;
  field_name: string;
  field_label: string;
  field_type: PdfFieldType;
  page_number: number;
  x_coordinate: number;
  y_coordinate: number;
  width: number;
  height: number;
  placeholder_source: PlaceholderSource | '';
  sort_order: number;
  is_required: boolean;
  font_size: number;
}

/**
 * PDF Field Mapper Component
 *
 * Allows users to view and edit the field mappings for a PDF template.
 * Fields define which data from the note gets placed where on the PDF.
 */
export function PdfFieldMapper({ template, onSave }: PdfFieldMapperProps) {
  const [fields, setFields] = useState<EditableField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch existing fields
  useEffect(() => {
    async function fetchFields() {
      try {
        const response = await fetch(`/api/templates/pdf/${template.id}/fields`);
        if (response.ok) {
          const data: PdfFormField[] = await response.json();
          setFields(
            data.map((f) => ({
              id: f.id,
              field_name: f.field_name,
              field_label: f.field_label,
              field_type: f.field_type,
              page_number: f.page_number,
              x_coordinate: f.x_coordinate,
              y_coordinate: f.y_coordinate,
              width: f.width,
              height: f.height,
              placeholder_source: f.placeholder_source as PlaceholderSource,
              sort_order: f.sort_order,
              is_required: f.is_required,
              font_size: f.font_size,
            }))
          );
        } else {
          setError('Failed to load fields');
        }
      } catch {
        setError('Failed to load fields');
      } finally {
        setLoading(false);
      }
    }

    fetchFields();
  }, [template.id]);

  // Add a new field
  const addField = () => {
    const newField: EditableField = {
      field_name: '',
      field_label: '',
      field_type: 'text',
      page_number: 1,
      x_coordinate: 50,
      y_coordinate: fields.length > 0 ? (fields[fields.length - 1].y_coordinate + 30) : 100,
      width: 500,
      height: 20,
      placeholder_source: '',
      sort_order: fields.length,
      is_required: false,
      font_size: 10,
    };
    setFields([...fields, newField]);
  };

  // Remove a field
  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  // Update a field
  const updateField = (index: number, updates: Partial<EditableField>) => {
    setFields(
      fields.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        // Auto-set field_name and label from placeholder source
        if (updates.placeholder_source) {
          const source = updates.placeholder_source as PlaceholderSource;
          updated.field_name = source;
          updated.field_label = PDF_PLACEHOLDER_SOURCES[source] || source;
          // Auto-set textarea for SOAP sections
          if (['subjective', 'objective', 'assessment', 'plan', 'patientHistory', 'shortTermGoals', 'longTermGoals', 'hep', 'billingJustification'].includes(source)) {
            updated.field_type = 'textarea';
            updated.height = 100;
          }
        }
        return updated;
      })
    );
  };

  // Save all fields
  const handleSave = async () => {
    // Validate
    const invalidFields = fields.filter((f) => !f.placeholder_source);
    if (invalidFields.length > 0) {
      setError('All fields must have a data source selected');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/templates/pdf/${template.id}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: fields.map((f, i) => ({
            ...f,
            sort_order: i,
          })),
        }),
      });

      if (response.ok) {
        setSuccess('Field mappings saved successfully!');
        setTimeout(() => onSave(), 1000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save — network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-500" />
            Field Mapper: {template.template_name}
          </CardTitle>
          <CardDescription>
            {DOCUMENT_NOTE_TYPE_LABELS[template.note_type]} — {template.clinic_name}
            {template.num_pages && ` — ${template.num_pages} page(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Map each section of your PDF template to a data source. When exporting a note,
            the system will fill in each mapped field with the corresponding note data.
          </p>
          {template.detected_sections && template.detected_sections.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-1">Auto-detected sections:</p>
              <div className="flex flex-wrap gap-1">
                {template.detected_sections.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Fields List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Mapped Fields ({fields.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={addField} className="gap-1">
              <Plus className="h-4 w-4" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No fields mapped yet. Click &quot;Add Field&quot; to start mapping sections.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id || index}
                  className="p-4 border rounded-lg bg-slate-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-slate-300" />
                      <span className="text-sm font-medium text-slate-700">
                        Field {index + 1}
                        {field.field_label && `: ${field.field_label}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(index)}
                      className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Data Source */}
                    <div className="space-y-1">
                      <Label className="text-xs">Data Source *</Label>
                      <Select
                        value={field.placeholder_source}
                        onValueChange={(v) =>
                          updateField(index, { placeholder_source: v as PlaceholderSource })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select data source..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PLACEHOLDER_GROUPS.map((group) => (
                            <div key={group.label}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                                {group.label}
                              </div>
                              {group.sources.map((source) => (
                                <SelectItem key={source.key} value={source.key}>
                                  {source.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Field Type */}
                    <div className="space-y-1">
                      <Label className="text-xs">Field Type</Label>
                      <Select
                        value={field.field_type}
                        onValueChange={(v) =>
                          updateField(index, {
                            field_type: v as PdfFieldType,
                            height: v === 'textarea' ? 100 : 20,
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Page Number */}
                    <div className="space-y-1">
                      <Label className="text-xs">Page</Label>
                      <Input
                        type="number"
                        min={1}
                        max={template.num_pages || 10}
                        value={field.page_number}
                        onChange={(e) =>
                          updateField(index, { page_number: parseInt(e.target.value) || 1 })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Position & Size */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">X Position</Label>
                      <Input
                        type="number"
                        value={field.x_coordinate}
                        onChange={(e) =>
                          updateField(index, { x_coordinate: parseFloat(e.target.value) || 0 })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Y Position</Label>
                      <Input
                        type="number"
                        value={field.y_coordinate}
                        onChange={(e) =>
                          updateField(index, { y_coordinate: parseFloat(e.target.value) || 0 })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Width</Label>
                      <Input
                        type="number"
                        value={field.width}
                        onChange={(e) =>
                          updateField(index, { width: parseFloat(e.target.value) || 200 })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Height</Label>
                      <Input
                        type="number"
                        value={field.height}
                        onChange={(e) =>
                          updateField(index, { height: parseFloat(e.target.value) || 20 })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Font Size</Label>
                      <Input
                        type="number"
                        min={6}
                        max={24}
                        value={field.font_size}
                        onChange={(e) =>
                          updateField(index, { font_size: parseFloat(e.target.value) || 10 })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Required toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.is_required}
                      onCheckedChange={(checked) => updateField(index, { is_required: checked })}
                    />
                    <Label className="text-xs text-slate-500">Required field</Label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={addField} className="gap-1">
          <Plus className="h-4 w-4" />
          Add Field
        </Button>
        <Button onClick={handleSave} disabled={saving || fields.length === 0} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Field Mappings
        </Button>
      </div>
    </div>
  );
}
