/**
 * Messages API
 * GET:  List messages for current user's clinic (filter by thread_id, patient_id, is_urgent)
 * POST: Send a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinic_id');
    const threadId = searchParams.get('thread_id');
    const patientId = searchParams.get('patient_id');
    const isUrgent = searchParams.get('is_urgent');
    const userId = searchParams.get('user_id');

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    let query = client
      .from('messages')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (threadId) {
      query = query.eq('thread_id', threadId);
    }

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    if (isUrgent === 'true') {
      query = query.eq('is_urgent', true);
    }

    if (userId) {
      query = query.or(`sender_id.eq.${userId},recipient_ids.cs.{${userId}}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      clinic_id,
      sender_id,
      thread_id,
      recipient_ids,
      subject,
      body: messageBody,
      is_urgent,
      patient_id,
      episode_id,
    } = body;

    if (!clinic_id || !sender_id || !recipient_ids || !messageBody) {
      return NextResponse.json(
        { error: 'clinic_id, sender_id, recipient_ids, and body are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('messages')
      .insert({
        clinic_id,
        sender_id,
        thread_id: thread_id || null,
        recipient_ids,
        subject: subject || null,
        body: messageBody,
        is_urgent: is_urgent || false,
        patient_id: patient_id || null,
        episode_id: episode_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
