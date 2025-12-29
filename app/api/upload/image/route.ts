import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getUserFromRequest } from '@/lib/auth';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-1',
  credentials: process.env.AWS_PROFILE
    ? undefined // AWS SDK will use the profile from environment
    : {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
});

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès refusé. Seuls les créateurs peuvent uploader des images.' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const imageType = formData.get('imageType') as string; // 'profile' or 'banner'

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    if (!imageType || !['profile', 'banner'].includes(imageType)) {
      return NextResponse.json(
        { error: 'Type d\'image invalide. Doit être "profile" ou "banner"' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier non accepté. Formats acceptés: JPG, PNG, WEBP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux. Taille maximum: 5MB' },
        { status: 400 }
      );
    }

    // Get creator ID
    const creator = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/me`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    }).then((res) => res.json());

    const creatorId = creator?.user?.creator?.id;

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Profil créateur introuvable' },
        { status: 404 }
      );
    }

    // Prepare file for upload
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = imageType === 'profile' ? `profile.${fileExtension}` : `banner.${fileExtension}`;
    const fileKey = `${process.env.AWS_FOLDER_PREFIX || 'callastar'}/creators/${creatorId}/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read', // Make the file publicly readable
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com/${fileKey}`;

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        message: 'Image uploadée avec succès',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload de l\'image', details: error?.message },
      { status: 500 }
    );
  }
}
