/**
 * Prior Authorization by ID API
 * PATCH: Update authorization (status, used_visits, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { id } = params;
    const body = await request.json();

    const allowedFields = [
      'auth_number',
      'insurance_name',
      'insurance_phone',
      'authorized_visits',
      'used_visits',
      'remaining_visits',
      'start_date',
      'end_date',
      'requested_date',
      'approved_date',
      'status',
      'notes',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Auto-calculate remaining_visits if authorized_visits or used_visits changed
    if (updateData.authorized_visits !== undefined || updateData.used_visits !== undefined) {
      // Fetch current values if needed
      if (updateData.authorized_visits === undefined || updateData.used_visits === undefined) {
        const { data: current } = await client
          .from('prior_authorizations')
          .select('authorized_visits, used_visits')
          .eq('id', id)
          .single();

        if (current) {
          const authVisits = (updateData.authorized_visits as number) ?? current.authorized_visits;
          const usedVisits = (updateData.used_visits as number) ?? current.used_visits;
          if (authVisits !== null) {
            updateData.remaining_visits = Math.max(0, authVisits - usedVisits);
          }
        }
      } else {
        const authVisits = updateData.authorized_visits as number;
        const usedVisits = updateData.used_visits as number;
        if (authVisits !== null) {
          updateData.remaining_visits = Math.max(0, authVisits - usedVisits);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('prior_authorizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating authorization:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/authorizations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
