/**
 * Goal Progress Notes API
 * POST: Add a progress note to a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: goalId } = await context.params;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      document_id,
      date_recorded,
      previous_value,
      current_value,
      progress_percentage,
      status,
      notes,
      recorded_by,
    } = body;

    if (!date_recorded) {
      return NextResponse.json(
        { error: 'date_recorded is required' },
        { status: 400 }
      );
    }

    // Create the progress note
    const { data: progressNote, error: progressError } = await client
      .from('goal_progress_notes')
      .insert({
        goal_id: goalId,
        document_id: document_id ?? null,
        date_recorded,
        previous_value: previous_value ?? null,
        current_value: current_value ?? null,
        progress_percentage: progress_percentage ?? null,
        status: status ?? null,
        notes: notes ?? null,
        recorded_by: recorded_by ?? null,
      })
      .select()
      .single();

    if (progressError) {
      console.error('Error creating progress note:', progressError);
      return NextResponse.json({ error: progressError.message }, { status: 500 });
    }

    // Also update the goal's current_value and progress_percentage if provided
    const goalUpdates: Record<string, unknown> = {};
    if (current_value !== undefined) {
      goalUpdates.current_value = current_value;
    }
    if (progress_percentage !== undefined) {
      goalUpdates.progress_percentage = progress_percentage;
    }
    if (status) {
      goalUpdates.status = status;
      if (status === 'met') {
        goalUpdates.met_date = date_recorded;
      }
    }

    if (Object.keys(goalUpdates).length > 0) {
      const { error: updateError } = await client
        .from('treatment_goals')
        .update(goalUpdates)
        .eq('id', goalId);

      if (updateError) {
        console.error('Error updating goal from progress note:', updateError);
      }
    }

    return NextResponse.json(progressNote, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/goals/[id]/progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
