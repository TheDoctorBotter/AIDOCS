/**
 * Document Signature by ID API
 * PATCH: Sign or reject (update status, signed_at/rejected_at)
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
    const { action, rejection_reason } = body;

    if (!action || !['sign', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "sign" or "reject"' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    let updateData: Record<string, unknown>;

    if (action === 'sign') {
      updateData = {
        status: 'signed',
        signed_at: now,
      };
    } else {
      if (!rejection_reason) {
        return NextResponse.json(
          { error: 'rejection_reason is required when rejecting' },
          { status: 400 }
        );
      }
      updateData = {
        status: 'rejected',
        rejected_at: now,
        rejection_reason,
      };
    }

    const { data, error } = await client
      .from('document_signatures')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating signature:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PATCH /api/signatures/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
