/**
 * CPT Codes API
 * GET: List CPT codes (filter by category, is_timed, search by code/description)
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
    const isTimed = searchParams.get('is_timed');
    const search = searchParams.get('search');

    let query = client
      .from('cpt_codes')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (isTimed !== null && isTimed !== undefined && isTimed !== '') {
      query = query.eq('is_timed', isTimed === 'true');
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching CPT codes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/cpt-codes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
