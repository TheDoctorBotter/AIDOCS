/**
 * Treatment Goals API
 * GET:  List goals (filter by episode_id, patient_id, status, goal_type)
 * POST: Create a new goal
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
    const goalType = searchParams.get('goal_type');

    let query = client
      .from('treatment_goals')
      .select('*')
      .order('goal_number', { ascending: true });

    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    if (episodeId) {
      query = query.eq('episode_id', episodeId);
    }

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (goalType) {
      query = query.eq('goal_type', goalType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching treatment goals:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/goals:', error);
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
      goal_type,
      goal_number,
      description,
      baseline_value,
      target_value,
      current_value,
      unit_of_measure,
      target_date,
      status,
      parent_goal_id,
      document_id,
      created_by,
    } = body;

    if (!episode_id || !patient_id || !clinic_id || !goal_type || !description) {
      return NextResponse.json(
        { error: 'episode_id, patient_id, clinic_id, goal_type, and description are required' },
        { status: 400 }
      );
    }

    // Auto-generate goal_number if not provided
    let finalGoalNumber = goal_number;
    if (!finalGoalNumber) {
      const { data: existingGoals } = await client
        .from('treatment_goals')
        .select('goal_number')
        .eq('episode_id', episode_id)
        .eq('goal_type', goal_type)
        .order('goal_number', { ascending: false })
        .limit(1);

      finalGoalNumber = existingGoals && existingGoals.length > 0
        ? existingGoals[0].goal_number + 1
        : 1;
    }

    const { data, error } = await client
      .from('treatment_goals')
      .insert({
        episode_id,
        patient_id,
        clinic_id,
        goal_type,
        goal_number: finalGoalNumber,
        description,
        baseline_value: baseline_value ?? null,
        target_value: target_value ?? null,
        current_value: current_value ?? baseline_value ?? null,
        unit_of_measure: unit_of_measure ?? null,
        target_date: target_date ?? null,
        status: status || 'active',
        progress_percentage: 0,
        parent_goal_id: parent_goal_id ?? null,
        document_id: document_id ?? null,
        created_by: created_by ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating treatment goal:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/goals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
