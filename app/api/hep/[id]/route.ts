/**
 * HEP Program Detail API
 * GET:    Get HEP program with all exercises (joined)
 * PATCH:  Update HEP program
 * DELETE: Delete HEP program
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { id } = params;

    const { data, error } = await client
      .from('hep_programs')
      .select('*, hep_program_exercises(*, exercise:exercise_library(*))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching HEP program:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/hep/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const { id } = params;

    const { data, error } = await client
      .from('hep_programs')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating HEP program:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/hep/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { id } = params;

    // Delete program exercises first
    const { error: exError } = await client
      .from('hep_program_exercises')
      .delete()
      .eq('hep_program_id', id);

    if (exError) {
      console.error('Error deleting HEP program exercises:', exError);
      return NextResponse.json({ error: exError.message }, { status: 500 });
    }

    // Delete the program
    const { error } = await client
      .from('hep_programs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting HEP program:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/hep/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
