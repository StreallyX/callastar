import { getTranslations } from 'next-intl/server';
import { Navbar } from '@/components/navbar';

export default async function TermsPage() {
  const t = await getTranslations('legal.terms');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />
      
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {t('title')}
        </h1>
        
        <p className="text-gray-600 mb-8">
          {t('lastUpdated')}: 29 décembre 2024 {/* TODO: Update with real date */}
        </p>

        <div className="prose prose-lg max-w-none space-y-8">
          {/* TODO: Replace all fictional information with real company data */}
          
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Informations Légales</h2>
            <p>
              {/* TODO: Replace with real company name */}
              <strong>Raison sociale:</strong> Call a Star SAS<br />
              {/* TODO: Replace with real SIRET */}
              <strong>SIRET:</strong> 123 456 789 00012<br />
              {/* TODO: Replace with real address */}
              <strong>Siège social:</strong> 123 Avenue des Champs-Élysées, 75008 Paris, France<br />
              {/* TODO: Replace with real capital */}
              <strong>Capital social:</strong> 50 000 €<br />
              {/* TODO: Replace with real contact */}
              <strong>Contact:</strong> contact@callastar.com
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Objet de la Plateforme</h2>
            <p>
              Call a Star est une plateforme mettant en relation des créateurs de contenu ("Créateurs") avec leurs fans ("Utilisateurs") 
              pour des appels vidéo payants.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Modèle de Commission</h2>
            <p>
              {/* TODO: Verify commission rate */}
              La plateforme prélève une commission de <strong>20%</strong> sur chaque appel réalisé. 
              Les créateurs reçoivent <strong>80%</strong> du montant de la réservation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Paiements via Stripe</h2>
            <p>
              Tous les paiements sont traités de manière sécurisée par <strong>Stripe</strong>, notre prestataire de services de paiement.
              En utilisant la plateforme, vous acceptez également les <a href="https://stripe.com/fr/legal" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">conditions d'utilisation de Stripe</a>.
            </p>
            <p>
              Les informations de carte bancaire ne sont jamais stockées sur nos serveurs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Politique de Remboursement</h2>
            <p className="font-semibold text-red-600">
              IMPORTANT: Aucun remboursement n'est possible une fois l'appel commencé.
            </p>
            <p>
              - Les annulations avant le début de l'appel peuvent donner lieu à un remboursement partiel selon les conditions du créateur.<br />
              - Une fois l'appel démarré, aucun remboursement ne sera effectué, même en cas de problème technique.<br />
              {/* TODO: Define precise cancellation policy */}
              - Les annulations doivent être effectuées au moins 24h avant l'heure prévue de l'appel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Obligations des Utilisateurs</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Respecter le créateur et maintenir un comportement approprié pendant l'appel</li>
              <li>Ne pas enregistrer, capturer ou partager le contenu de l'appel sans autorisation explicite</li>
              <li>Fournir des informations exactes lors de l'inscription</li>
              <li>Être présent à l'heure prévue de l'appel</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Obligations des Créateurs</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Être présent et ponctuel pour les appels réservés</li>
              <li>Fournir un contenu conforme aux lois en vigueur</li>
              <li>Respecter les utilisateurs</li>
              <li>Déclarer les revenus générés conformément aux obligations fiscales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Propriété Intellectuelle</h2>
            <p>
              Tout le contenu de la plateforme (logo, design, textes) est protégé par les droits d'auteur.
              {/* TODO: Verify IP ownership details */}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation de Responsabilité</h2>
            <p>
              La plateforme agit comme intermédiaire et ne peut être tenue responsable du contenu des appels ou des interactions entre utilisateurs et créateurs.
              {/* TODO: Review with legal counsel */}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Droit Applicable</h2>
            <p>
              {/* TODO: Confirm jurisdiction */}
              Ces CGU sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents de Paris.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
