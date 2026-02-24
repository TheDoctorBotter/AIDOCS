/**
 * Outcome Measure Scores API
 * GET:  List scores (filter by patient_id, episode_id, measure_id, date range)
 * POST: Record a new score
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
    const episodeId = searchParams.get('episode_id');
    const measureId = searchParams.get('measure_id');
    const clinicId = searchParams.get('clinic_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = searchParams.get('limit');

    let query = client
      .from('outcome_measure_scores')
      .select(`
        *,
        measure:outcome_measure_definitions(name, abbreviation, category, min_score, max_score, higher_is_better, mcid, score_interpretation)
      `)
      .order('date_administered', { ascending: false });

    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    if (episodeId) {
      query = query.eq('episode_id', episodeId);
    }

    if (measureId) {
      query = query.eq('measure_id', measureId);
    }

    if (from) {
      query = query.gte('date_administered', from);
    }

    if (to) {
      query = query.lte('date_administered', to);
    }

    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching outcome measure scores:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten measure data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scores = (data || []).map((score: any) => {
      const measureData = score.measure as Record<string, unknown> | Record<string, unknown>[] | null;
      const measure = Array.isArray(measureData) ? measureData[0] : measureData;
      return {
        ...score,
        measure_name: measure?.name || null,
        measure_abbreviation: measure?.abbreviation || null,
        measure_category: measure?.category || null,
        measure_min_score: measure?.min_score || null,
        measure_max_score: measure?.max_score || null,
        measure_higher_is_better: measure?.higher_is_better ?? null,
        measure_mcid: measure?.mcid || null,
        measure_score_interpretation: measure?.score_interpretation || null,
        measure: undefined,
      };
    });

    return NextResponse.json(scores);
  } catch (error) {
    console.error('Error in GET /api/outcome-measures/scores:', error);
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
      episode_id,
      clinic_id,
      measure_id,
      date_administered,
      raw_score,
      percentage_score,
      answers,
      administered_by,
      notes,
      document_id,
    } = body;

    if (!patient_id || !episode_id || !clinic_id || !measure_id || !date_administered || raw_score === undefined) {
      return NextResponse.json(
        { error: 'patient_id, episode_id, clinic_id, measure_id, date_administered, and raw_score are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('outcome_measure_scores')
      .insert({
        patient_id,
        episode_id,
        clinic_id,
        measure_id,
        date_administered,
        raw_score,
        percentage_score: percentage_score ?? null,
        answers: answers ?? null,
        administered_by: administered_by ?? null,
        notes: notes ?? null,
        document_id: document_id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating outcome measure score:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/outcome-measures/scores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
