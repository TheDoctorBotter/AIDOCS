/**
 * Patient Files API
 * GET: List all files for a patient
 * POST: Upload a file from the clinic side (manual upload)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const STORAGE_BUCKET = 'patient-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;

    const { data, error } = await supabaseAdmin
      .from('patient_files')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching patient files:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Refresh signed URLs for any files that have storage paths
    const filesWithUrls = await Promise.all(
      (data || []).map(async (file) => {
        if (file.storage_path) {
          const { data: urlData } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.storage_path, 60 * 60); // 1-hour URL
          return { ...file, file_url: urlData?.signedUrl || file.file_url };
        }
        return file;
      })
    );

    return NextResponse.json(filesWithUrls);
  } catch (error) {
    console.error('Error fetching patient files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const fileType = formData.get('file_type') as string | null;
    const clinicId = formData.get('clinic_id') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file || !fileType || !clinicId) {
      return NextResponse.json(
        { error: 'file, file_type, and clinic_id are required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${clinicId}/${patientId}/${fileType}_${timestamp}_${sanitizedName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message);
      return NextResponse.json(
        { error: 'Failed to store file' },
        { status: 500 }
      );
    }

    const { data: urlData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    // Create metadata record
    const { data: fileRecord, error: dbError } = await supabaseAdmin
      .from('patient_files')
      .insert({
        patient_id: patientId,
        clinic_id: clinicId,
        file_type: fileType,
        file_name: file.name,
        file_url: urlData?.signedUrl || null,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/pdf',
        status: 'received',
        uploaded_by: 'clinic',
        notes: notes || null,
        metadata: {},
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(fileRecord, { status: 201 });
  } catch (error) {
    console.error('Error uploading patient file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
