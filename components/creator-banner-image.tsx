'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AlertCircle } from 'lucide-react';

interface CreatorBannerImageProps {
  bannerImage?: string | null;
  alt?: string;
}

export function CreatorBannerImage({ bannerImage, alt = 'Banner' }: CreatorBannerImageProps) {
  const [imageError, setImageError] = useState(false);

  if (!bannerImage) {
    return null;
  }

  if (imageError) {
    return (
      <div className="relative w-full h-64 bg-gradient-to-r from-purple-200 to-pink-200 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">Image de bannière indisponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 bg-gradient-to-r from-purple-200 to-pink-200">
      <Image
        src={bannerImage}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}
