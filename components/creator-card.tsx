'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface CreatorCardProps {
  creator: {
    id: string;
    bio?: string | null;
    profileImage?: string | null;
    user: {
      id: string;
      name: string;
    };
    callOffers?: Array<{
      id: string;
      title: string;
    }>;
  };
  locale: string;
}

export function CreatorCard({ creator, locale }: CreatorCardProps) {
  const t = useTranslations('components.creatorCard');
  const [imageError, setImageError] = useState(false);
  const offersCount = creator?.callOffers?.length ?? 0;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="relative aspect-square bg-gradient-to-br from-purple-200 to-pink-200">
          {creator?.profileImage && !imageError ? (
            <Image
              src={creator.profileImage}
              alt={creator?.user?.name ?? t('creator')}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {imageError ? (
                <div className="text-center text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">{t('imageUnavailable')}</p>
                </div>
              ) : (
                <Star className="w-16 h-16 text-purple-600" />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-2">{creator?.user?.name ?? t('unknown')}</h3>
        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
          {creator?.bio ?? t('noBio')}
        </p>
        
        {offersCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>
              {t('offersCount', { count: offersCount })}
            </span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-6 pt-0">
        <Link href={`/${locale}/creators/${creator?.id}`} className="w-full">
          <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
            {t('viewProfile')}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
