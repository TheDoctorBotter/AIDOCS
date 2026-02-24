/**
 * Visit Charges API
 * GET:  List visit charges (filter by episode_id, patient_id, clinic_id, date range, status)
 * POST: Create a charge (auto-calculate units from minutes using 8-minute rule if is_timed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';
import { calculateBillingUnits } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const episodeId = searchParams.get('episode_id');
    const patientId = searchParams.get('patient_id');
    const clinicId = searchParams.get('clinic_id');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = client
      .from('visit_charges')
      .select('*')
      .order('date_of_service', { ascending: false });

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
    if (from) {
      query = query.gte('date_of_service', from);
    }
    if (to) {
      query = query.lte('date_of_service', to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching charges:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/charges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      visit_id,
      document_id,
      episode_id,
      patient_id,
      clinic_id,
      cpt_code_id,
      cpt_code,
      description,
      minutes_spent,
      units,
      modifier_1,
      modifier_2,
      diagnosis_pointer,
      charge_amount,
      date_of_service,
      status,
      created_by,
      is_timed,
    } = body;

    if (!episode_id || !patient_id || !clinic_id || !cpt_code_id || !cpt_code || !date_of_service) {
      return NextResponse.json(
        { error: 'episode_id, patient_id, clinic_id, cpt_code_id, cpt_code, and date_of_service are required' },
        { status: 400 }
      );
    }

    // Auto-calculate units from minutes using 8-minute rule if is_timed
    let calculatedUnits = units || 1;
    if (is_timed && minutes_spent) {
      calculatedUnits = calculateBillingUnits(minutes_spent);
    }

    const { data, error } = await client
      .from('visit_charges')
      .insert({
        visit_id: visit_id || null,
        document_id: document_id || null,
        episode_id,
        patient_id,
        clinic_id,
        cpt_code_id,
        cpt_code,
        description: description || null,
        minutes_spent: minutes_spent || null,
        units: calculatedUnits,
        modifier_1: modifier_1 || null,
        modifier_2: modifier_2 || null,
        diagnosis_pointer: diagnosis_pointer || null,
        charge_amount: charge_amount || null,
        date_of_service,
        status: status || 'pending',
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating charge:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/charges:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
