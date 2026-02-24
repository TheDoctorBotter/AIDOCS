/**
 * Single Treatment Goal API
 * GET:   Get a single goal with its progress history
 * PATCH: Update goal (status, progress, current_value, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    // Fetch the goal
    const { data: goal, error: goalError } = await client
      .from('treatment_goals')
      .select('*')
      .eq('id', id)
      .single();

    if (goalError) {
      if (goalError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
      console.error('Error fetching goal:', goalError);
      return NextResponse.json({ error: goalError.message }, { status: 500 });
    }

    // Fetch progress history
    const { data: progressNotes, error: progressError } = await client
      .from('goal_progress_notes')
      .select('*')
      .eq('goal_id', id)
      .order('date_recorded', { ascending: false });

    if (progressError) {
      console.error('Error fetching progress notes:', progressError);
    }

    return NextResponse.json({
      ...goal,
      progress_notes: progressNotes || [],
    });
  } catch (error) {
    console.error('Error in GET /api/goals/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const allowedFields = [
      'status',
      'current_value',
      'progress_percentage',
      'target_value',
      'target_date',
      'met_date',
      'description',
      'status_notes',
      'updated_by',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Auto-set met_date when status changes to 'met'
    if (updates.status === 'met' && !updates.met_date) {
      updates.met_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await client
      .from('treatment_goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
      console.error('Error updating goal:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/goals/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
