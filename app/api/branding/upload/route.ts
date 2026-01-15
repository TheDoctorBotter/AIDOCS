import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const BUCKET_NAME = 'branding';

export async function POST(request: NextRequest) {
  try {
    console.log('[Branding Upload] Starting upload request');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('[Branding Upload] SUPABASE_URL is not configured');
      return NextResponse.json(
        {
          error: 'Missing SUPABASE_URL',
          details: 'Server configuration error. Please configure SUPABASE_URL in .env file.',
        },
        { status: 500 }
      );
    }

    if (!supabaseServiceKey) {
      console.error('[Branding Upload] SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        {
          error: 'Missing SUPABASE_SERVICE_ROLE_KEY',
          details: 'Server configuration error. Please configure SUPABASE_SERVICE_ROLE_KEY in .env file.',
        },
        { status: 500 }
      );
    }

    console.log('[Branding Upload] Creating Supabase admin client');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    console.log('[Branding Upload] File info:', {
      hasFile: !!file,
      type,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
    });

    if (!file) {
      console.error('[Branding Upload] No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!type || (type !== 'logo' && type !== 'letterhead')) {
      console.error('[Branding Upload] Invalid type:', type);
      return NextResponse.json(
        { error: 'Invalid type. Must be "logo" or "letterhead"' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      console.error('[Branding Upload] File too large:', file.size);
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error('[Branding Upload] Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPEG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const fileName = `${type}-${timestamp}.${fileExt}`;
    const filePath = `branding/${fileName}`;

    console.log('[Branding Upload] Preparing upload to path:', filePath);

    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    console.log('[Branding Upload] Uploading to Supabase Storage...');
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileData, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[Branding Upload] Upload error:', JSON.stringify(uploadError));

      if (uploadError.message.includes('Bucket not found')) {
        return NextResponse.json(
          {
            error: 'Storage bucket not found',
            details: 'The "branding" bucket does not exist. Please create it in Supabase Dashboard > Storage.',
          },
          { status: 500 }
        );
      }

      if (uploadError.message.includes('signature')) {
        return NextResponse.json(
          {
            error: 'Authentication failed',
            details: 'Invalid Supabase credentials. Please verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'Upload failed',
          details: uploadError.message,
        },
        { status: 500 }
      );
    }

    console.log('[Branding Upload] Upload successful:', uploadData.path);

    console.log('[Branding Upload] Creating signed URL...');
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);

    if (signedUrlError) {
      console.error('[Branding Upload] Signed URL error:', JSON.stringify(signedUrlError));
      return NextResponse.json(
        {
          error: 'Failed to create signed URL',
          details: signedUrlError.message,
        },
        { status: 500 }
      );
    }

    console.log('[Branding Upload] Success - returning URL');

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      path: uploadData.path,
    });
  } catch (error) {
    console.error('[Branding Upload] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[Branding Upload] Error stack:', errorStack);

    return NextResponse.json(
      {
        error: errorMessage,
        details: 'An unexpected error occurred during upload. Check server logs for details.',
      },
      { status: 500 }
    );
  }
}
