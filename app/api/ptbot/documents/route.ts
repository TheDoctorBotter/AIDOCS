/**
 * PTBot Documents API
 * POST: Receive documents (consent forms, referrals) from PTBot
 *
 * Accepts base64-encoded file data in JSON payload.
 * Stores file in Supabase Storage and creates metadata record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const VALID_FILE_TYPES = ['consent_form', 'referral', 'insurance_card', 'other'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const STORAGE_BUCKET = 'patient-files';

interface PTBotDocumentPayload {
  patient_email?: string | null;
  patient_name?: string;
  patient_external_id?: string;
  file_type: string;
  file_name: string;
  file_data: string; // base64-encoded
  mime_type?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

async function ensureStorageBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === STORAGE_BUCKET);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
    });
  }
}

async function findPatient(
  clinicId: string,
  email?: string | null,
  externalId?: string
): Promise<string | null> {
  // Try by external_id first
  if (externalId) {
    const { data } = await supabaseAdmin
      .from('patient_external_ids')
      .select('patient_id')
      .eq('source', 'ptbot')
      .eq('external_id', externalId)
      .maybeSingle();

    if (data?.patient_id) return data.patient_id;
  }

  // Then by email
  if (email) {
    const { data } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('email', email)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const expectedKey = process.env.PTBOT_API_KEY;

    if (!expectedKey || !token || token !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const clinicId = process.env.PTBOT_DEFAULT_CLINIC_ID;
    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'PTBOT_DEFAULT_CLINIC_ID not configured' },
        { status: 503 }
      );
    }

    // 2. Parse payload
    const body: PTBotDocumentPayload = await request.json();

    if (!body.file_type || !body.file_name || !body.file_data) {
      return NextResponse.json(
        { success: false, error: 'file_type, file_name, and file_data are required' },
        { status: 400 }
      );
    }

    if (!VALID_FILE_TYPES.includes(body.file_type as typeof VALID_FILE_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid file_type. Must be one of: ${VALID_FILE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Find patient
    let patientId = await findPatient(clinicId, body.patient_email, body.patient_external_id);

    // Auto-create patient if not found and we have enough info
    if (!patientId && (body.patient_email || body.patient_name)) {
      const name = body.patient_name || body.patient_email || 'Unknown';
      let firstName = 'Unknown';
      let lastName = 'Patient';

      if (name.includes(',')) {
        const parts = name.split(',').map((p) => p.trim());
        lastName = parts[0] || 'Patient';
        firstName = parts[1] || 'Unknown';
      } else {
        const parts = name.trim().split(/\s+/);
        firstName = parts[0] || 'Unknown';
        lastName = parts.slice(1).join(' ') || 'Patient';
      }

      const { data: newPatient, error: createError } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id: clinicId,
          first_name: firstName,
          last_name: lastName,
          email: body.patient_email ?? null,
          is_active: true,
          primary_diagnosis: 'Telehealth consult via PTBot',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[ptbot/documents] Patient creation error:', createError.message);
        return NextResponse.json(
          { success: false, error: 'Failed to create patient record' },
          { status: 500 }
        );
      }

      patientId = newPatient.id;

      // Link external ID if provided
      if (body.patient_external_id) {
        await supabaseAdmin.from('patient_external_ids').upsert(
          {
            patient_id: patientId,
            source: 'ptbot',
            external_id: body.patient_external_id,
          },
          { onConflict: 'source,external_id' }
        );
      }
    }

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'Could not identify patient. Provide patient_email, patient_name, or patient_external_id.' },
        { status: 400 }
      );
    }

    // 4. Decode and upload file
    const fileBuffer = Buffer.from(body.file_data, 'base64');
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    await ensureStorageBucket();

    const timestamp = Date.now();
    const sanitizedName = body.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${clinicId}/${patientId}/${body.file_type}_${timestamp}_${sanitizedName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: body.mime_type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[ptbot/documents] Storage upload error:', uploadError.message);
      return NextResponse.json(
        { success: false, error: 'Failed to store file' },
        { status: 500 }
      );
    }

    // Get a signed URL (valid for 10 years — effectively permanent for this use case)
    const { data: urlData } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

    // 5. Create metadata record
    const { data: fileRecord, error: dbError } = await supabaseAdmin
      .from('patient_files')
      .insert({
        patient_id: patientId,
        clinic_id: clinicId,
        file_type: body.file_type,
        file_name: body.file_name,
        file_url: urlData?.signedUrl || null,
        storage_path: storagePath,
        file_size: fileBuffer.length,
        mime_type: body.mime_type || 'application/pdf',
        status: 'received',
        uploaded_by: 'ptbot',
        notes: body.notes || null,
        metadata: body.metadata || {},
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[ptbot/documents] DB insert error:', dbError.message);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    console.log('[ptbot/documents] Document stored', {
      file_id: fileRecord.id,
      patient_id: patientId,
      file_type: body.file_type,
    });

    return NextResponse.json(
      {
        success: true,
        file_id: fileRecord.id,
        patient_id: patientId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[ptbot/documents] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
