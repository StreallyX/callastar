'use client';

import { Star } from 'lucide-react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('homepage.footer');

  return (
    <footer className="border-t mt-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="flex items-center gap-2 text-gray-600">
            <Star className="w-5 h-5 text-purple-600" />
            <span>{t('copyright')}</span>
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link 
              href="/legal/terms" 
              className="text-gray-600 hover:text-purple-600 transition-colors"
            >
              {t('terms')}
            </Link>
            <Link 
              href="/legal/privacy" 
              className="text-gray-600 hover:text-purple-600 transition-colors"
            >
              {t('privacy')}
            </Link>
            <Link 
              href="/legal/notice" 
              className="text-gray-600 hover:text-purple-600 transition-colors"
            >
              {t('legal')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
