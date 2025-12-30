import { getTranslations } from 'next-intl/server';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { FileQuestion } from 'lucide-react';

export default async function NotFound({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: 'errors.notFound' });

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />
      <div className="container mx-auto max-w-7xl px-4 py-24">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-8 p-6 bg-purple-100 rounded-full">
            <FileQuestion className="w-24 h-24 text-purple-600" />
          </div>
          <h1 className="text-6xl font-bold mb-4 text-gray-900">404</h1>
          <h2 className="text-3xl font-semibold mb-4 text-gray-800">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-md">
            {t('description')}
          </p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              {t('backHome')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
