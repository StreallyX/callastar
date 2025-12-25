import { Navbar } from '@/components/navbar';
import { CreatorCard } from '@/components/creator-card';
import { db } from '@/lib/db';

async function getCreators() {
  try {
    const creators = await db.creator.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        callOffers: {
          where: {
            dateTime: {
              gte: new Date(),
            },
          },
          orderBy: {
            dateTime: 'asc',
          },
          take: 1,
        },
      },
      take: 50,
    });
    
    return { creators };
  } catch (error) {
    console.error('Error fetching creators:', error);
    return { creators: [] };
  }
}

export default async function CreatorsPage() {
  const data = await getCreators();
  const creators = data?.creators ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Nos Créateurs
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Découvrez tous nos créateurs et réservez un appel vidéo privé avec votre star préférée
          </p>
        </div>

        {creators?.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator: any) => (
              <CreatorCard key={creator?.id} creator={creator} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun créateur disponible pour le moment</p>
          </div>
        )}
      </div>
    </div>
  );
}
