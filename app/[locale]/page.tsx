import { Star, Video, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { CreatorCard } from '@/components/creator-card';
import { Link } from '@/navigation';
import { getTranslations } from 'next-intl/server';

async function getCreators() {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/creators?limit=6`,
      { cache: 'no-store' }
    );

    if (!response.ok) return { creators: [] };

    const data = await response.json();
    return data ?? { creators: [] };
  } catch (error) {
    console.error('Error fetching creators:', error);
    return { creators: [] };
  }
}

export async function generateMetadata({
  params
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'homepage.meta'
  });

  return {
    title: t('title'),
    description: t('description')
  };
}

export default async function HomePage({
  params
}: {
  params: { locale: string };
}) {
  const { locale } = params;

  const data = await getCreators();
  const creators = data?.creators ?? [];

  const t = await getTranslations({
    locale,
    namespace: 'homepage'
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      {/* Hero */}
      <section className="container mx-auto max-w-7xl px-4 py-20">
        <div className="text-center space-y-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
            <Star className="h-10 w-10 fill-white text-white" />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('hero.title')}
          </h1>

          <p className="mx-auto max-w-2xl text-xl text-gray-600">
            {t('hero.description')}
          </p>

          <div className="flex justify-center gap-4 pt-4">
            <Link href="/auth/register" locale={locale}>
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {t('hero.becomeCreator')}
              </Button>
            </Link>

            <Link href="/creators" locale={locale}>
              <Button size="lg" variant="outline">
                {t('hero.exploreCreators')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Video className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              {t('features.videoCall.title')}
            </h3>
            <p className="text-gray-600">
              {t('features.videoCall.description')}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
              <Calendar className="h-6 w-6 text-pink-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              {t('features.easyBooking.title')}
            </h3>
            <p className="text-gray-600">
              {t('features.easyBooking.description')}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              {t('features.uniqueExperience.title')}
            </h3>
            <p className="text-gray-600">
              {t('features.uniqueExperience.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Creators */}
      {creators.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">
              {t('popularCreators.title')}
            </h2>
            <p className="text-gray-600">
              {t('popularCreators.description')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator: any) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/creators" locale={locale}>
              <Button size="lg" variant="outline">
                {t('popularCreators.seeAll')}
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-20 border-t">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Star className="h-5 w-5" />
            <span>{t('footer.copyright')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
