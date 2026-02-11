/**
 * Clinics API
 * GET: List all clinics
 * POST: Create a new clinic
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { data, error } = await client
      .from('clinics')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching clinics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/clinics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const { name, address, phone, email, website, user_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 });
    }

    // Create the clinic
    const { data, error } = await client
      .from('clinics')
      .insert({
        name,
        address,
        phone,
        email,
        website,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating clinic:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create a membership linking the current user as admin of the new clinic
    if (user_id && data) {
      const { error: membershipError } = await client
        .from('clinic_memberships')
        .insert({
          user_id,
          clinic_id: data.id,
          clinic_id_ref: data.id,
          clinic_name: data.name,
          role: 'admin',
          is_active: true,
        });

      if (membershipError) {
        console.error('Error creating clinic membership:', membershipError);
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/clinics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
