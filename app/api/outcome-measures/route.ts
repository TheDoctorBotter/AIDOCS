/**
 * Outcome Measure Definitions API
 * GET: List outcome measure definitions (filter by category, is_active)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');

    let query = client
      .from('outcome_measure_definitions')
      .select('*')
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching outcome measure definitions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/outcome-measures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
