import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const { password, reason } = await request.json();

    if (!password || !reason) {
      return NextResponse.json(
        { error: 'Password and reason are required' },
        { status: 400 }
      );
    }

    // Get the current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify the admin's password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || '',
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Check if user is an admin for the patient's clinic
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('clinic_id')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Verify user is admin for this clinic
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('clinic_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('clinic_id', patient.clinic_id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Soft delete the patient
    const { data, error } = await supabaseAdmin
      .from('patients')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        delete_reason: reason,
      })
      .eq('id', patientId)
      .select()
      .single();

    if (error) {
      console.error('Error soft deleting patient:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Patient deleted successfully',
      data,
    });
  } catch (error) {
    console.error('Error in POST /api/patients/[id]/delete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
