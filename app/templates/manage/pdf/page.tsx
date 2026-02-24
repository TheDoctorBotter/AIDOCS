'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Upload,
  FileText,
  Star,
  Building2,
  Loader2,
  AlertCircle,
  Check,
  Settings2,
} from 'lucide-react';
import {
  PdfFormTemplate,
  DocumentNoteType,
  DOCUMENT_NOTE_TYPE_LABELS,
} from '@/lib/templates/types';
import { PdfFieldMapper } from '@/components/PdfFieldMapper';

export default function PdfTemplateManagementPage() {
  const [templates, setTemplates] = useState<PdfFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    clinic_name: '',
    note_type: '' as DocumentNoteType | '',
    template_name: '',
    description: '',
    is_default: false,
    file: null as File | null,
  });

  // Field mapper state
  const [mappingTemplate, setMappingTemplate] = useState<PdfFormTemplate | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates/pdf');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      } else {
        setError('Failed to load PDF templates');
      }
    } catch {
      setError('Failed to load PDF templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.endsWith('.pdf')) {
      setError('Please select a PDF file');
      return;
    }
    setUploadForm((prev) => ({ ...prev, file }));
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.clinic_name || !uploadForm.note_type || !uploadForm.template_name) {
      setError('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('clinic_name', uploadForm.clinic_name);
      formData.append('note_type', uploadForm.note_type);
      formData.append('template_name', uploadForm.template_name);
      formData.append('description', uploadForm.description);
      formData.append('is_default', String(uploadForm.is_default));

      const response = await fetch('/api/templates/pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(
          `PDF template uploaded! ${result.auto_detected_fields || 0} fields auto-detected. ${
            result.pdf_info?.hasFormFields
              ? 'Existing form fields found and mapped.'
              : 'Default fields generated — click "Map Fields" to customize.'
          }`
        );
        setUploadOpen(false);
        setUploadForm({
          clinic_name: '',
          note_type: '',
          template_name: '',
          description: '',
          is_default: false,
          file: null,
        });
        fetchTemplates();

        // Auto-open field mapper for the new template
        setTimeout(() => {
          setMappingTemplate(result);
        }, 500);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch {
      setError('Upload failed — network error');
    } finally {
      setUploading(false);
    }
  };

  // Get unique clinic names
  const clinicNames = Array.from(new Set(templates.map((t) => t.clinic_name))).sort();

  // If we're in field mapping mode
  if (mappingTemplate) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => setMappingTemplate(null)}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to PDF Templates
        </Button>
        <PdfFieldMapper
          template={mappingTemplate}
          onSave={() => {
            setMappingTemplate(null);
            setSuccess('Field mappings saved!');
            fetchTemplates();
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/templates/manage">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                DOCX Templates
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold">PDF Note Templates</h1>
          <p className="text-slate-500 mt-1">
            Upload your PDF note templates and map fillable sections for Evaluation,
            Re-Evaluation, Daily Note, and Discharge documents.
          </p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload PDF Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload PDF Note Template</DialogTitle>
              <DialogDescription>
                Upload your clinic&apos;s PDF note template. The system will
                detect sections and create fillable fields automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pdf-file">PDF File *</Label>
                <Input
                  id="pdf-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                />
                {uploadForm.file && (
                  <p className="text-sm text-slate-500">
                    {uploadForm.file.name} ({Math.round(uploadForm.file.size / 1024)}KB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-clinic">Clinic Name *</Label>
                <Input
                  id="pdf-clinic"
                  placeholder="e.g., Buckeye Pediatric PT"
                  value={uploadForm.clinic_name}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, clinic_name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-notetype">Note Type *</Label>
                <Select
                  value={uploadForm.note_type}
                  onValueChange={(v) =>
                    setUploadForm((prev) => ({ ...prev, note_type: v as DocumentNoteType }))
                  }
                >
                  <SelectTrigger id="pdf-notetype">
                    <SelectValue placeholder="Select note type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_NOTE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-name">Template Name *</Label>
                <Input
                  id="pdf-name"
                  placeholder="e.g., Standard Daily SOAP"
                  value={uploadForm.template_name}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, template_name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-desc">Description</Label>
                <Textarea
                  id="pdf-desc"
                  placeholder="Optional description..."
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="pdf-default"
                  checked={uploadForm.is_default}
                  onCheckedChange={(checked) =>
                    setUploadForm((prev) => ({ ...prev, is_default: checked }))
                  }
                />
                <Label htmlFor="pdf-default">Set as default for this note type</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload & Analyze
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">No PDF templates yet</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Upload your clinic&apos;s PDF note template (Evaluation, Daily Note, etc.)
              and the system will create the fillable sections for you.
            </p>
            <Button className="mt-4 gap-2" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload First PDF Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clinicNames.map((clinicName) => (
            <Card key={clinicName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-slate-400" />
                  {clinicName}
                </CardTitle>
                <CardDescription>
                  {templates.filter((t) => t.clinic_name === clinicName).length} PDF template(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templates
                    .filter((t) => t.clinic_name === clinicName)
                    .map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-red-500" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.template_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {DOCUMENT_NOTE_TYPE_LABELS[template.note_type]}
                              </Badge>
                              {template.is_default && (
                                <Badge variant="outline" className="text-xs">
                                  <Star className="h-3 w-3 mr-1 fill-current text-yellow-500" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500">
                              {template.file_name} — {template.num_pages || '?'} page(s)
                              {template.detected_sections?.length > 0 && (
                                <span>
                                  {' '}
                                  — {template.detected_sections.length} sections detected
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setMappingTemplate(template)}
                        >
                          <Settings2 className="h-4 w-4" />
                          Map Fields
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
