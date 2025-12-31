'use client';

import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  const t = useTranslations('errors.loading');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />
      <div className="container mx-auto max-w-7xl px-4 py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="w-16 h-16 text-purple-600 animate-spin mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            {t('title')}
          </h2>
          <p className="text-gray-600">
            {t('message')}
          </p>
        </div>
      </div>
    </div>
  );
}
