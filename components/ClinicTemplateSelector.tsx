'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, FileText, Star, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DocumentTemplate,
  PdfFormTemplate,
  DocumentNoteType,
  DOCUMENT_NOTE_TYPE_LABELS,
  TemplateType,
  UnifiedTemplate,
} from '@/lib/templates/types';

/** Returned when a template is selected — includes the type discriminator */
export interface SelectedTemplate {
  template: DocumentTemplate | PdfFormTemplate;
  type: TemplateType;
}

interface ClinicTemplateSelectorProps {
  /** Called when a template is selected */
  onTemplateSelect: (selection: SelectedTemplate | null) => void;
  /** Pre-selected clinic name */
  defaultClinic?: string;
  /** Pre-selected note type */
  defaultNoteType?: DocumentNoteType;
  /** Filter to show only specific note types */
  noteTypeFilter?: DocumentNoteType[];
  /** Show only clinics that have templates */
  showOnlyWithTemplates?: boolean;
  /** Additional CSS class */
  className?: string;
}

interface UnifiedEntry extends UnifiedTemplate {
  _source: DocumentTemplate | PdfFormTemplate;
}

/**
 * Clinic and Template Selector Component
 *
 * Supports both DOCX and PDF templates.
 * Two-step selection:
 * 1. Select clinic/brand
 * 2. Select note type (filtered by clinic's available templates)
 *
 * Automatically selects the default template when available.
 */
export function ClinicTemplateSelector({
  onTemplateSelect,
  defaultClinic,
  defaultNoteType,
  noteTypeFilter,
  showOnlyWithTemplates = true,
  className,
}: ClinicTemplateSelectorProps) {
  const [docxTemplates, setDocxTemplates] = useState<DocumentTemplate[]>([]);
  const [pdfTemplates, setPdfTemplates] = useState<PdfFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedClinic, setSelectedClinic] = useState<string>(defaultClinic || '');
  const [selectedNoteType, setSelectedNoteType] = useState<DocumentNoteType | ''>(
    defaultNoteType || ''
  );
  const [selectedEntry, setSelectedEntry] = useState<UnifiedEntry | null>(null);

  // Fetch all templates (DOCX + PDF in parallel)
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const [docxRes, pdfRes] = await Promise.all([
          fetch('/api/templates/document'),
          fetch('/api/templates/pdf'),
        ]);

        if (docxRes.ok) {
          setDocxTemplates(await docxRes.json());
        }
        if (pdfRes.ok) {
          setPdfTemplates(await pdfRes.json());
        }

        if (!docxRes.ok && !pdfRes.ok) {
          setError('Failed to load templates');
        }
      } catch (err) {
        setError(`Network error: ${err instanceof Error ? err.message : 'Failed to load templates'}`);
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  // Build unified template list
  const allEntries: UnifiedEntry[] = [
    ...docxTemplates.map(
      (t): UnifiedEntry => ({
        id: t.id,
        type: 'docx',
        clinic_name: t.clinic_name,
        note_type: t.note_type,
        template_name: t.template_name,
        is_default: t.is_default,
        file_name: t.file_name,
        _source: t,
      })
    ),
    ...pdfTemplates.map(
      (t): UnifiedEntry => ({
        id: t.id,
        type: 'pdf',
        clinic_name: t.clinic_name,
        note_type: t.note_type,
        template_name: t.template_name,
        is_default: t.is_default,
        file_name: t.file_name,
        _source: t,
      })
    ),
  ];

  // Get unique clinic names
  const clinicNames = Array.from(new Set(allEntries.map((t) => t.clinic_name))).sort();

  // Get available note types for selected clinic
  const availableNoteTypes = selectedClinic
    ? Array.from(
        new Set(
          allEntries
            .filter((t) => t.clinic_name === selectedClinic)
            .filter((t) => !noteTypeFilter || noteTypeFilter.includes(t.note_type))
            .map((t) => t.note_type)
        )
      )
    : [];

  // Get templates for selected clinic + note type
  const matchingEntries =
    selectedClinic && selectedNoteType
      ? allEntries.filter(
          (t) => t.clinic_name === selectedClinic && t.note_type === selectedNoteType
        )
      : [];

  // Auto-select default template when clinic + note type are selected
  useEffect(() => {
    if (selectedClinic && selectedNoteType && matchingEntries.length > 0) {
      const defaultEntry = matchingEntries.find((t) => t.is_default);
      const entryToSelect = defaultEntry || matchingEntries[0];
      setSelectedEntry(entryToSelect);
      onTemplateSelect({ template: entryToSelect._source, type: entryToSelect.type });
    } else {
      setSelectedEntry(null);
      onTemplateSelect(null);
    }
  }, [selectedClinic, selectedNoteType, docxTemplates, pdfTemplates]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle clinic change
  const handleClinicChange = (clinic: string) => {
    setSelectedClinic(clinic);
    setSelectedNoteType('');
    setSelectedEntry(null);
    onTemplateSelect(null);
  };

  // Handle note type change
  const handleNoteTypeChange = (noteType: DocumentNoteType) => {
    setSelectedNoteType(noteType);
  };

  // Handle explicit template selection (when multiple templates exist)
  const handleTemplateChange = (templateId: string) => {
    const entry = matchingEntries.find((t) => t.id === templateId) || null;
    setSelectedEntry(entry);
    if (entry) {
      onTemplateSelect({ template: entry._source, type: entry.type });
    } else {
      onTemplateSelect(null);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (allEntries.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No templates available</h3>
          <p className="text-slate-500 mt-1">
            Please upload clinic templates (DOCX or PDF) in the template management page first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Select Clinic & Template
        </CardTitle>
        <CardDescription>
          Choose the clinic brand and note type for this documentation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Clinic Selection */}
        <div className="space-y-2">
          <Label htmlFor="clinic-select">Clinic / Brand</Label>
          <Select value={selectedClinic} onValueChange={handleClinicChange}>
            <SelectTrigger id="clinic-select">
              <SelectValue placeholder="Select a clinic..." />
            </SelectTrigger>
            <SelectContent>
              {clinicNames.map((clinic) => (
                <SelectItem key={clinic} value={clinic}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    {clinic}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Note Type Selection */}
        {selectedClinic && (
          <div className="space-y-2">
            <Label htmlFor="notetype-select">Note Type</Label>
            <Select
              value={selectedNoteType}
              onValueChange={(v) => handleNoteTypeChange(v as DocumentNoteType)}
            >
              <SelectTrigger id="notetype-select">
                <SelectValue placeholder="Select note type..." />
              </SelectTrigger>
              <SelectContent>
                {availableNoteTypes.map((noteType) => (
                  <SelectItem key={noteType} value={noteType}>
                    {DOCUMENT_NOTE_TYPE_LABELS[noteType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableNoteTypes.length === 0 && (
              <p className="text-sm text-slate-500">
                No templates available for this clinic. Please upload templates first.
              </p>
            )}
          </div>
        )}

        {/* Template Selection (if multiple templates for same clinic + type) */}
        {matchingEntries.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="template-select">Template Version</Label>
            <Select
              value={selectedEntry?.id || ''}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                {matchingEntries.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    <div className="flex items-center gap-2">
                      <FileText
                        className={`h-4 w-4 ${
                          entry.type === 'pdf' ? 'text-red-500' : 'text-blue-500'
                        }`}
                      />
                      {entry.template_name}
                      <Badge variant="outline" className="text-xs ml-1">
                        {entry.type.toUpperCase()}
                      </Badge>
                      {entry.is_default && (
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selected Template Preview */}
        {selectedEntry && (
          <div className="p-3 bg-slate-50 rounded-lg border">
            <div className="flex items-center gap-2">
              <FileText
                className={`h-5 w-5 ${
                  selectedEntry.type === 'pdf' ? 'text-red-500' : 'text-blue-500'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedEntry.template_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedEntry.type.toUpperCase()}
                  </Badge>
                  {selectedEntry.is_default && (
                    <Badge variant="outline" className="text-xs">
                      <Star className="h-3 w-3 mr-1 fill-current text-yellow-500" />
                      Default
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {selectedEntry.file_name}
                </div>
              </div>
            </div>
            {selectedEntry.type === 'docx' && 'placeholders_detected' in selectedEntry._source && (
              <div className="mt-2 text-xs text-slate-400">
                Supports: {(selectedEntry._source as DocumentTemplate).placeholders_detected?.slice(0, 8).join(', ')}
                {((selectedEntry._source as DocumentTemplate).placeholders_detected?.length || 0) > 8 && '...'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
