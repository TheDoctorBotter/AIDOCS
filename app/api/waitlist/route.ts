/**
 * Waitlist API
 * GET:    List waitlist entries for a clinic
 * POST:   Add patient to waitlist
 * PATCH:  Update waitlist entry status
 * DELETE: Remove from waitlist
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
    const status = searchParams.get('status');

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    let query = client
      .from('waitlist')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('priority', { ascending: true })
      .order('added_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching waitlist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/waitlist:', error);
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
      patient_id,
      episode_id,
      preferred_therapist_id,
      preferred_days,
      preferred_time_start,
      preferred_time_end,
      priority,
      notes,
    } = body;

    if (!clinic_id || !patient_id) {
      return NextResponse.json(
        { error: 'clinic_id and patient_id are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('waitlist')
      .insert({
        clinic_id,
        patient_id,
        episode_id: episode_id || null,
        preferred_therapist_id: preferred_therapist_id || null,
        preferred_days: preferred_days || null,
        preferred_time_start: preferred_time_start || null,
        preferred_time_end: preferred_time_end || null,
        priority: priority ?? 5,
        notes: notes || null,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding to waitlist:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/waitlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const allowedFields = [
      'preferred_therapist_id',
      'preferred_days',
      'preferred_time_start',
      'preferred_time_end',
      'priority',
      'notes',
      'status',
      'removed_at',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updateFields) {
        updateData[field] = updateFields[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // If status is being set to removed, auto-set removed_at
    if (updateData.status === 'removed' && !updateData.removed_at) {
      updateData.removed_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from('waitlist')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating waitlist entry:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/waitlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await client
      .from('waitlist')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting waitlist entry:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/waitlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
