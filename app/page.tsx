import Link from 'next/link';
import { Star, Video, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { CreatorCard } from '@/components/creator-card';

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

export default async function HomePage() {
  const data = await getCreators();
  const creators = data?.creators ?? [];

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
            Connectez-vous avec vos stars
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Réservez des appels vidéo privés avec vos influenceurs et créateurs préférés.
            Une expérience unique et personnalisée.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/auth/register">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Sparkles className="w-5 h-5 mr-2" />
                Devenir créateur
              </Button>
            </Link>
            <Link href="/creators">
              <Button size="lg" variant="outline">
                Explorer les créateurs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto max-w-7xl px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl bg-white shadow-sm border">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Appels vidéo HD</h3>
            <p className="text-gray-600">
              Profitez d'appels vidéo de haute qualité sécurisés et privés.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Réservation facile</h3>
            <p className="text-gray-600">
              Choisissez votre créateur, sélectionnez un créneau et réservez en quelques clics.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white shadow-sm border">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Expérience unique</h3>
            <p className="text-gray-600">
              Vivez un moment priviligié et personnalisé avec votre star préférée.
            </p>
          </div>
        </div>
      </section>

      {/* Creators Section */}
      {creators?.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Créateurs populaires</h2>
            <p className="text-gray-600">Découvrez nos créateurs les plus demandés</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator: any) => (
              <CreatorCard key={creator?.id} creator={creator} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/creators">
              <Button size="lg" variant="outline">
                Voir tous les créateurs
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Star className="w-5 h-5" />
            <span>© 2024 Call a Star. Tous droits réservés.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
