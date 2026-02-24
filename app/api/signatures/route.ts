/**
 * Document Signatures API
 * GET:  List signatures for a document (filter by document_id, status)
 * POST: Create signature request (for co-sign workflow)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('document_id');
    const status = searchParams.get('status');
    const signerUserId = searchParams.get('signer_user_id');
    const signatureType = searchParams.get('signature_type');
    const clinicId = searchParams.get('clinic_id');

    let query = client
      .from('document_signatures')
      .select('*')
      .order('created_at', { ascending: false });

    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (signerUserId) {
      query = query.eq('signer_user_id', signerUserId);
    }
    if (signatureType) {
      query = query.eq('signature_type', signatureType);
    }
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching signatures:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/signatures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      document_id,
      clinic_id,
      signer_user_id,
      signer_role,
      signer_name,
      signer_credentials,
      signature_type,
      attestation,
    } = body;

    if (!document_id || !signer_user_id || !signer_role || !signer_name || !signature_type) {
      return NextResponse.json(
        { error: 'document_id, signer_user_id, signer_role, signer_name, and signature_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('document_signatures')
      .insert({
        document_id,
        clinic_id: clinic_id || null,
        signer_user_id,
        signer_role,
        signer_name,
        signer_credentials: signer_credentials || null,
        signature_type,
        status: 'pending',
        attestation: attestation || 'I attest that I have reviewed this document and agree with its contents.',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating signature:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/signatures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
