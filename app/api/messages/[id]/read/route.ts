/**
 * Message Read Receipt API
 * POST: Mark message as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { id } = params;
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Insert into message_reads table
    const { data, error } = await client
      .from('message_reads')
      .upsert(
        {
          message_id: id,
          user_id,
          read_at: new Date().toISOString(),
        },
        { onConflict: 'message_id,user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error marking message as read:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/messages/[id]/read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
