'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, AlertCircle } from 'lucide-react';

interface CreatorProfileImageProps {
  profileImage?: string | null;
  alt?: string;
  hasBanner?: boolean;
}

export function CreatorProfileImage({ profileImage, alt = 'Profile', hasBanner = false }: CreatorProfileImageProps) {
  const [imageError, setImageError] = useState(false);

  const containerClass = `relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-purple-200 to-pink-200 flex-shrink-0 border-4 border-white ${hasBanner ? '-mt-20' : ''}`;

  if (!profileImage || imageError) {
    return (
      <div className={containerClass}>
        <div className="w-full h-full flex items-center justify-center">
          {imageError ? (
            <div className="text-center text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto" />
            </div>
          ) : (
            <Star className="w-16 h-16 text-purple-600" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <Image
        src={profileImage}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}
