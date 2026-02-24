/**
 * PDF Template Fields API
 *
 * GET:  List all fields for a PDF template
 * PUT:  Replace all fields for a PDF template (bulk update from field mapper)
 * POST: Add a single field to a PDF template
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const { data, error } = await client
      .from('pdf_form_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/templates/pdf/[id]/fields:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const body = await request.json();
    const { fields } = body;

    if (!Array.isArray(fields)) {
      return NextResponse.json({ error: 'fields must be an array' }, { status: 400 });
    }

    // Verify template exists
    const { data: template, error: templateError } = await client
      .from('pdf_form_templates')
      .select('id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Delete existing fields
    await client
      .from('pdf_form_fields')
      .delete()
      .eq('template_id', templateId);

    // Insert new fields
    if (fields.length > 0) {
      const fieldsToInsert = fields.map((f: Record<string, unknown>, index: number) => ({
        template_id: templateId,
        field_name: f.field_name || f.placeholder_source || `field_${index}`,
        field_label: f.field_label || '',
        field_type: f.field_type || 'text',
        page_number: f.page_number || 1,
        x_coordinate: f.x_coordinate || 0,
        y_coordinate: f.y_coordinate || 0,
        width: f.width || 200,
        height: f.height || 20,
        placeholder_source: f.placeholder_source,
        sort_order: f.sort_order ?? index,
        is_required: f.is_required || false,
        font_size: f.font_size || 10,
        font_name: f.font_name || 'Helvetica',
      }));

      const { error: insertError } = await client
        .from('pdf_form_fields')
        .insert(fieldsToInsert);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Fetch updated fields
    const { data: updatedFields, error: fetchError } = await client
      .from('pdf_form_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json(updatedFields);
  } catch (error) {
    console.error('Error in PUT /api/templates/pdf/[id]/fields:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceRoleKey ? supabaseAdmin : supabase;

    const field = await request.json();

    const { data, error } = await client
      .from('pdf_form_fields')
      .insert({
        template_id: templateId,
        field_name: field.field_name || field.placeholder_source,
        field_label: field.field_label || '',
        field_type: field.field_type || 'text',
        page_number: field.page_number || 1,
        x_coordinate: field.x_coordinate || 0,
        y_coordinate: field.y_coordinate || 0,
        width: field.width || 200,
        height: field.height || 20,
        placeholder_source: field.placeholder_source,
        sort_order: field.sort_order || 0,
        is_required: field.is_required || false,
        font_size: field.font_size || 10,
        font_name: field.font_name || 'Helvetica',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/templates/pdf/[id]/fields:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
