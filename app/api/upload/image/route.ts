import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

// S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    // 🔐 Auth
    const jwtUser = await getUserFromRequest(request);

    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès réservé aux créateurs' },
        { status: 403 }
      );
    }

    // 📦 FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const imageType = formData.get('imageType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!imageType || !['profile', 'banner'].includes(imageType)) {
      return NextResponse.json(
        { error: 'Type d’image invalide (profile | banner)' },
        { status: 400 }
      );
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non supporté (jpg, png, webp uniquement)' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image trop volumineuse (max 5MB)' },
        { status: 400 }
      );
    }

    // 👤 Creator
    const user = await db.user.findUnique({
      where: { id: jwtUser.userId },
      include: { creator: true },
    });

    if (!user?.creator) {
      return NextResponse.json(
        { error: 'Profil créateur introuvable' },
        { status: 404 }
      );
    }

    const creatorId = user.creator.id;
    const basePath = `${process.env.AWS_FOLDER_PREFIX || 'creators'}/${creatorId}/`;

    // 🧹 1️⃣ SUPPRIMER LES ANCIENS FICHIERS (profile.* ou banner.*)
    const listResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Prefix: basePath,
      })
    );

    const objectsToDelete =
      listResponse.Contents?.filter(
        (obj) =>
          obj.Key &&
          obj.Key.startsWith(`${basePath}${imageType}.`)
      ).map((obj) => ({ Key: obj.Key! })) || [];

    if (objectsToDelete.length > 0) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Delete: {
            Objects: objectsToDelete,
          },
        })
      );
    }

    // 🧱 2️⃣ NOUVEAU NOM DE FICHIER
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${imageType}.${extension}`;
    const key = `${basePath}${fileName}`;

    // 🔄 Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // ☁️ 3️⃣ Upload S3 (sans ACL)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // 🌍 URL publique
    const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // ✅ CRITICAL: Update database immediately after S3 upload
    try {
      await db.creator.update({
        where: { id: creatorId },
        data: imageType === 'profile'
          ? { profileImage: publicUrl }
          : { bannerImage: publicUrl },
      });
    } catch (dbError: any) {
      console.error('Database update error:', dbError);
      return NextResponse.json(
        { error: 'Image uploadée mais erreur lors de la mise à jour de la base de données', details: dbError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: 'Image uploadée et profil mis à jour avec succès',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l’upload', details: error?.message },
      { status: 500 }
    );
  }
}
