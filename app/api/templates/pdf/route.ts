/**
 * PDF Templates API
 *
 * GET:  List all PDF form templates (optional filters: clinic_name, note_type)
 * POST: Upload a new PDF template — analyzes for sections and AcroForm fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import { analyzePdf, detectAcroFormFields, generateDefaultFields } from '@/lib/templates/pdf-engine';
import { DocumentNoteType } from '@/lib/templates/types';

const STORAGE_BUCKET = 'document-templates';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;
    const { searchParams } = new URL(request.url);
    const clinicName = searchParams.get('clinic_name');
    const noteType = searchParams.get('note_type') as DocumentNoteType | null;

    let query = client
      .from('pdf_form_templates')
      .select('*')
      .order('clinic_name', { ascending: true })
      .order('note_type', { ascending: true })
      .order('created_at', { ascending: false });

    if (clinicName) {
      query = query.eq('clinic_name', clinicName);
    }
    if (noteType) {
      query = query.eq('note_type', noteType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching PDF templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/templates/pdf:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clinicName = formData.get('clinic_name') as string | null;
    const noteType = formData.get('note_type') as DocumentNoteType | null;
    const templateName = formData.get('template_name') as string | null;
    const description = formData.get('description') as string | null;
    const isDefault = formData.get('is_default') === 'true';

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!clinicName) {
      return NextResponse.json({ error: 'clinic_name is required' }, { status: 400 });
    }
    if (!noteType) {
      return NextResponse.json({ error: 'note_type is required' }, { status: 400 });
    }
    if (!templateName) {
      return NextResponse.json({ error: 'template_name is required' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Read file buffer
    const fileBuffer = await file.arrayBuffer();

    // Analyze the PDF
    let pdfInfo;
    try {
      pdfInfo = await analyzePdf(fileBuffer);
    } catch (err) {
      console.error('PDF analysis failed:', err);
      return NextResponse.json(
        { error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
        { status: 400 }
      );
    }

    // Generate storage key
    const timestamp = Date.now();
    const sanitizedClinic = clinicName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedName = templateName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileKey = `${sanitizedClinic}/${noteType}/pdf_${sanitizedName}_${timestamp}.pdf`;

    // Upload to Supabase Storage
    const { error: uploadError } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(fileKey, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      if (uploadError.message.includes('Bucket not found')) {
        return NextResponse.json(
          {
            error: 'Storage bucket not found',
            details: `The "${STORAGE_BUCKET}" bucket does not exist. Please create it in Supabase Dashboard > Storage.`,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Unset existing defaults if this should be default
    if (isDefault) {
      await client
        .from('pdf_form_templates')
        .update({ is_default: false })
        .eq('clinic_name', clinicName)
        .eq('note_type', noteType);
    }

    // Create database record
    const { data: templateRecord, error: dbError } = await client
      .from('pdf_form_templates')
      .insert({
        clinic_name: clinicName,
        note_type: noteType,
        template_name: templateName,
        description: description || null,
        file_key: fileKey,
        file_name: file.name,
        file_size: file.size,
        is_default: isDefault,
        num_pages: pdfInfo.numPages,
        detected_sections: pdfInfo.detectedSections,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file
      await client.storage.from(STORAGE_BUCKET).remove([fileKey]);
      console.error('Error creating PDF template record:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Auto-generate field mappings
    let autoFields: Array<Partial<import('@/lib/templates/types').PdfFormField>> = [];

    if (pdfInfo.hasFormFields) {
      // If the PDF already has fillable form fields, detect and map them
      autoFields = await detectAcroFormFields(fileBuffer);
    } else {
      // Generate default fields based on note type
      const pageWidth = pdfInfo.pageWidths[0] || 612;
      const pageHeight = pdfInfo.pageHeights[0] || 792;
      const defaults = generateDefaultFields(noteType, pageWidth, pageHeight);
      autoFields = defaults.map((f) => ({
        ...f,
        template_id: templateRecord.id,
      }));
    }

    // Insert auto-generated fields
    if (autoFields.length > 0) {
      const fieldsToInsert = autoFields
        .filter((f) => f.placeholder_source) // Only insert fields with a mapped source
        .map((f) => ({
          template_id: templateRecord.id,
          field_name: f.field_name || f.placeholder_source,
          field_label: f.field_label || f.field_name || '',
          field_type: f.field_type || 'text',
          page_number: f.page_number || 1,
          x_coordinate: f.x_coordinate || 0,
          y_coordinate: f.y_coordinate || 0,
          width: f.width || 200,
          height: f.height || 20,
          placeholder_source: f.placeholder_source,
          sort_order: f.sort_order || 0,
          is_required: f.is_required || false,
          font_size: f.font_size || 10,
          font_name: f.font_name || 'Helvetica',
        }));

      if (fieldsToInsert.length > 0) {
        const { error: fieldsError } = await client
          .from('pdf_form_fields')
          .insert(fieldsToInsert);

        if (fieldsError) {
          console.error('Error inserting auto-detected fields:', fieldsError);
          // Non-fatal — template is still created, fields can be added manually
        }
      }
    }

    return NextResponse.json(
      {
        ...templateRecord,
        auto_detected_fields: autoFields.length,
        pdf_info: {
          numPages: pdfInfo.numPages,
          hasFormFields: pdfInfo.hasFormFields,
          formFieldNames: pdfInfo.formFieldNames,
          detectedSections: pdfInfo.detectedSections,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/templates/pdf:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
