/**
 * Therapist Availability API
 * GET:    List availability for a therapist (filter by clinic_id, user_id)
 * POST:   Create availability block
 * PATCH:  Update availability block
 * DELETE: Delete availability block
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
    const userId = searchParams.get('user_id');

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    let query = client
      .from('therapist_availability')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching therapist availability:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/therapist-availability:', error);
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
      user_id,
      day_of_week,
      start_time,
      end_time,
      is_available,
      label,
      effective_from,
      effective_until,
    } = body;

    if (!clinic_id || !user_id || day_of_week === undefined || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'clinic_id, user_id, day_of_week, start_time, and end_time are required' },
        { status: 400 }
      );
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json(
        { error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('therapist_availability')
      .insert({
        clinic_id,
        user_id,
        day_of_week,
        start_time,
        end_time,
        is_available: is_available !== undefined ? is_available : true,
        label: label || null,
        effective_from: effective_from || new Date().toISOString().split('T')[0],
        effective_until: effective_until || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating therapist availability:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/therapist-availability:', error);
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
      'day_of_week',
      'start_time',
      'end_time',
      'is_available',
      'label',
      'effective_from',
      'effective_until',
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

    const { data, error } = await client
      .from('therapist_availability')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating therapist availability:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Availability block not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/therapist-availability:', error);
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
      .from('therapist_availability')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting therapist availability:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/therapist-availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
