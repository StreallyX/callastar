import { Star, Video, Calendar, Sparkles, Shield, Users, CheckCircle, TrendingUp, DollarSign, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { CreatorCard } from '@/components/creator-card';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'homepage.meta' });
  
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function HomePage({ params,}: { params: { locale: string };}) {

  const data = await getCreators();
  const creators = data?.creators ?? [];
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'homepage',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto max-w-7xl px-4 py-20">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
            <Star className="w-10 h-10 text-white fill-white" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('hero.title')}
          </h1>
          
          <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">
            {t('hero.subtitle')}
          </p>

          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            {t('hero.description')}
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/auth/register">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Sparkles className="w-5 h-5 mr-2" />
                {t('hero.becomeCreator')}
              </Button>
            </Link>
            <Link href="/creators">
              <Button size="lg" variant="outline">
                {t('hero.exploreCreators')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="container mx-auto max-w-7xl px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('about.title')}</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              {t('about.description')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* What is it used for */}
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-purple-600 mb-4">
                {t('about.usedFor.title')}
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{t('about.usedFor.consultations')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{t('about.usedFor.coaching')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{t('about.usedFor.advice')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{t('about.usedFor.meetGreet')}</span>
                </li>
              </ul>
            </div>

            {/* Who is it for */}
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-pink-600 mb-4">
                {t('about.forWhom.title')}
              </h3>
              
              <div className="bg-purple-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-6 h-6 text-purple-600" />
                  <h4 className="font-semibold text-lg">{t('about.forWhom.users.title')}</h4>
                </div>
                <p className="text-gray-700">{t('about.forWhom.users.description')}</p>
              </div>

              <div className="bg-pink-50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-6 h-6 text-pink-600" />
                  <h4 className="font-semibold text-lg">{t('about.forWhom.creators.title')}</h4>
                </div>
                <p className="text-gray-700">{t('about.forWhom.creators.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto max-w-7xl px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.title')}</h2>
          <p className="text-lg text-gray-600">{t('features.description')}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-white shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('features.booking.title')}</h3>
            <p className="text-gray-600">
              {t('features.booking.description')}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('features.payments.title')}</h3>
            <p className="text-gray-600">
              {t('features.payments.description')}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('features.videoCalls.title')}</h3>
            <p className="text-gray-600">
              {t('features.videoCalls.description')}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('features.reviews.title')}</h3>
            <p className="text-gray-600">
              {t('features.reviews.description')}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('features.profiles.title')}</h3>
            <p className="text-gray-600">
              {t('features.profiles.description')}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('features.offers.title')}</h3>
            <p className="text-gray-600">
              {t('features.offers.description')}
            </p>
          </div>
        </div>
      </section>

      {/* User Journey Section */}
      <section className="container mx-auto max-w-7xl px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('journey.title')}</h2>
          <p className="text-lg text-gray-600">{t('journey.description')}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center mb-4 mx-auto text-white text-2xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('journey.step1.title')}</h3>
            <p className="text-gray-600">{t('journey.step1.description')}</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-600 to-pink-400 flex items-center justify-center mb-4 mx-auto text-white text-2xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('journey.step2.title')}</h3>
            <p className="text-gray-600">{t('journey.step2.description')}</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-4 mx-auto text-white text-2xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('journey.step3.title')}</h3>
            <p className="text-gray-600">{t('journey.step3.description')}</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center mb-4 mx-auto text-white text-2xl font-bold">
              4
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('journey.step4.title')}</h3>
            <p className="text-gray-600">{t('journey.step4.description')}</p>
          </div>
        </div>
      </section>

      {/* Creators Section */}
      {creators?.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">{t('popularCreators.title')}</h2>
            <p className="text-gray-600">{t('popularCreators.description')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator: any) => (
              <CreatorCard key={creator?.id} creator={creator} locale={params.locale} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/creators">
              <Button size="lg" variant="outline">
                {t('popularCreators.seeAll')}
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="container mx-auto max-w-7xl px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Users CTA */}
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-8 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('cta.users.title')}</h2>
            <p className="text-purple-100 mb-6">{t('cta.users.description')}</p>
            <Link href="/creators">
              <Button size="lg" variant="secondary" className="bg-white text-purple-600 hover:bg-gray-100">
                {t('cta.users.button')}
              </Button>
            </Link>
          </div>

          {/* Creators CTA */}
          <div className="bg-gradient-to-br from-pink-600 to-pink-700 rounded-2xl p-8 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('cta.creators.title')}</h2>
            <p className="text-pink-100 mb-6">{t('cta.creators.description')}</p>
            <Link href="/auth/register">
              <Button size="lg" variant="secondary" className="bg-white text-pink-600 hover:bg-gray-100">
                {t('cta.creators.button')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
