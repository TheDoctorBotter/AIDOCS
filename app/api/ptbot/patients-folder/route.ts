/**
 * PTBot Patients Folder API
 * GET: List all PTBot-linked patients with their document status
 *
 * Returns patients that have either:
 * - A PTBot note (notes with ptbot_external_id in input_data)
 * - A PTBot document (patient_files with uploaded_by='ptbot')
 * - A PTBot external ID link (patient_external_ids with source='ptbot')
 *
 * Each patient includes counts of consent forms, referrals, and notes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

interface PTBotPatientSummary {
  patient_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  date_of_birth: string | null;
  created_at: string;
  has_consent_form: boolean;
  has_referral: boolean;
  note_count: number;
  file_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinic_id');

    if (!clinicId) {
      return NextResponse.json(
        { error: 'clinic_id is required' },
        { status: 400 }
      );
    }

    // 1. Get patient IDs from PTBot notes
    const { data: ptbotNotes } = await supabaseAdmin
      .from('notes')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .not('input_data->>ptbot_external_id', 'is', null)
      .not('patient_id', 'is', null);

    // 2. Get patient IDs from PTBot external IDs
    const { data: externalIds } = await supabaseAdmin
      .from('patient_external_ids')
      .select('patient_id')
      .eq('source', 'ptbot');

    // 3. Get patient IDs from PTBot-uploaded files
    const { data: ptbotFiles } = await supabaseAdmin
      .from('patient_files')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .eq('uploaded_by', 'ptbot');

    // Combine and deduplicate patient IDs
    const patientIdSet = new Set<string>();
    ptbotNotes?.forEach((n) => { if (n.patient_id) patientIdSet.add(n.patient_id); });
    externalIds?.forEach((e) => { if (e.patient_id) patientIdSet.add(e.patient_id); });
    ptbotFiles?.forEach((f) => { if (f.patient_id) patientIdSet.add(f.patient_id); });

    const patientIds = Array.from(patientIdSet);

    if (patientIds.length === 0) {
      return NextResponse.json([]);
    }

    // 4. Fetch patient details
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, date_of_birth, created_at')
      .in('id', patientIds)
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('last_name', { ascending: true });

    if (patientsError) {
      console.error('Error fetching PTBot patients:', patientsError);
      return NextResponse.json({ error: patientsError.message }, { status: 500 });
    }

    // 5. Fetch file counts per patient
    const { data: allFiles } = await supabaseAdmin
      .from('patient_files')
      .select('patient_id, file_type')
      .in('patient_id', patientIds)
      .eq('clinic_id', clinicId);

    // 6. Fetch note counts per patient
    const { data: allNotes } = await supabaseAdmin
      .from('notes')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .not('input_data->>ptbot_external_id', 'is', null)
      .in('patient_id', patientIds);

    // Build summary per patient
    const result: PTBotPatientSummary[] = (patients || []).map((patient) => {
      const patientFiles = allFiles?.filter((f) => f.patient_id === patient.id) || [];
      const patientNotes = allNotes?.filter((n) => n.patient_id === patient.id) || [];

      return {
        patient_id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        date_of_birth: patient.date_of_birth,
        created_at: patient.created_at,
        has_consent_form: patientFiles.some((f) => f.file_type === 'consent_form'),
        has_referral: patientFiles.some((f) => f.file_type === 'referral'),
        note_count: patientNotes.length,
        file_count: patientFiles.length,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching PTBot patients folder:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
