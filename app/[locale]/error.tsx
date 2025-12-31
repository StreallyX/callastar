'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.serverError');

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />
      <div className="container mx-auto max-w-7xl px-4 py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-8 p-6 bg-red-100 rounded-full">
            <AlertCircle className="w-24 h-24 text-red-600" />
          </div>
          <h1 className="text-6xl font-bold mb-4 text-gray-900">500</h1>
          <h2 className="text-3xl font-semibold mb-4 text-gray-800">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-md">
            {t('description')}
          </p>
          <div className="flex gap-4">
            <Button
              onClick={reset}
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              {t('tryAgain')}
            </Button>
            <Link href="/">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                {t('backHome')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
