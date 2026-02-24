/**
 * Prior Authorizations API
 * GET:  List prior authorizations (filter by episode_id, patient_id, status)
 * POST: Create new authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const episodeId = searchParams.get('episode_id');
    const patientId = searchParams.get('patient_id');
    const clinicId = searchParams.get('clinic_id');
    const status = searchParams.get('status');

    let query = client
      .from('prior_authorizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (episodeId) {
      query = query.eq('episode_id', episodeId);
    }
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching authorizations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/authorizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      episode_id,
      patient_id,
      clinic_id,
      auth_number,
      insurance_name,
      insurance_phone,
      authorized_visits,
      start_date,
      end_date,
      requested_date,
      approved_date,
      status,
      notes,
      created_by,
    } = body;

    if (!episode_id || !patient_id || !clinic_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'episode_id, patient_id, clinic_id, start_date, and end_date are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('prior_authorizations')
      .insert({
        episode_id,
        patient_id,
        clinic_id,
        auth_number: auth_number || null,
        insurance_name: insurance_name || null,
        insurance_phone: insurance_phone || null,
        authorized_visits: authorized_visits || null,
        used_visits: 0,
        remaining_visits: authorized_visits || null,
        start_date,
        end_date,
        requested_date: requested_date || null,
        approved_date: approved_date || null,
        status: status || 'pending',
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating authorization:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/authorizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
