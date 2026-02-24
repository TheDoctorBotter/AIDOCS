/**
 * Audit Log API
 * GET:  List audit log entries (filter by clinic_id, user_id, action, resource_type, date range). Paginated.
 * POST: Record an audit log entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get('clinic_id');
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resource_type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 });
    }

    let query = client
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching audit log:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error('Error in GET /api/audit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const {
      clinic_id,
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      resource_description,
      changes,
      ip_address,
      user_agent,
    } = body;

    if (!action || !resource_type) {
      return NextResponse.json(
        { error: 'action and resource_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('audit_log')
      .insert({
        clinic_id: clinic_id || null,
        user_id: user_id || null,
        user_email: user_email || null,
        action,
        resource_type,
        resource_id: resource_id || null,
        resource_description: resource_description || null,
        changes: changes || null,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording audit log:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/audit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
