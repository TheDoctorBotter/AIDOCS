/**
 * Patient Payments API
 * GET:  List payments (filter by patient_id, clinic_id, date range)
 * POST: Record a payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patient_id');
    const clinicId = searchParams.get('clinic_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = client
      .from('patient_payments')
      .select('*')
      .order('date_received', { ascending: false });

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }
    if (from) {
      query = query.gte('date_received', from);
    }
    if (to) {
      query = query.lte('date_received', to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/payments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      patient_id,
      clinic_id,
      visit_id,
      amount,
      payment_type,
      payment_method,
      reference_number,
      date_received,
      notes,
      collected_by,
    } = body;

    if (!patient_id || !clinic_id || !amount || !payment_type || !date_received) {
      return NextResponse.json(
        { error: 'patient_id, clinic_id, amount, payment_type, and date_received are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('patient_payments')
      .insert({
        patient_id,
        clinic_id,
        visit_id: visit_id || null,
        amount,
        payment_type,
        payment_method: payment_method || null,
        reference_number: reference_number || null,
        date_received,
        notes: notes || null,
        collected_by: collected_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/payments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
