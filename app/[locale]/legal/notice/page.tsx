import { getTranslations } from 'next-intl/server';
import { Navbar } from '@/components/navbar';

export default async function LegalNoticePage() {
  const t = await getTranslations('legal.notice');

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
            <h2 className="text-2xl font-semibold mb-4">1. Éditeur du Site</h2>
            <p>
              {/* TODO: Replace with real company name */}
              <strong>Raison sociale:</strong> Call a Star SAS<br />
              {/* TODO: Replace with real legal form */}
              <strong>Forme juridique:</strong> Société par Actions Simplifiée (SAS)<br />
              {/* TODO: Replace with real SIRET */}
              <strong>SIRET:</strong> 123 456 789 00012<br />
              {/* TODO: Replace with real capital */}
              <strong>Capital social:</strong> 50 000 €<br />
              {/* TODO: Replace with real RCS */}
              <strong>RCS:</strong> Paris B 123 456 789<br />
              {/* TODO: Replace with real VAT */}
              <strong>N° TVA intracommunautaire:</strong> FR12345678901
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Siège Social</h2>
            <p>
              {/* TODO: Replace with real address */}
              Call a Star SAS<br />
              123 Avenue des Champs-Élysées<br />
              75008 Paris<br />
              France
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Contact</h2>
            <p>
              {/* TODO: Replace with real contact details */}
              <strong>Email:</strong> <a href="mailto:contact@callastar.com" className="text-purple-600 hover:underline">contact@callastar.com</a><br />
              <strong>Téléphone:</strong> +33 1 23 45 67 89
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Directeur de la Publication</h2>
            <p>
              {/* TODO: Replace with real director name */}
              <strong>Nom:</strong> Jean Dupont<br />
              <strong>Qualité:</strong> Président de Call a Star SAS
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Hébergement</h2>
            <p>
              {/* TODO: Replace with real hosting provider */}
              Le site est hébergé par:<br />
              <strong>Hébergeur:</strong> Vercel Inc.<br />
              <strong>Adresse:</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, USA<br />
              <strong>Site web:</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">vercel.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Propriété Intellectuelle</h2>
            <p>
              L'ensemble du contenu de ce site (textes, images, logo, design) est la propriété exclusive de Call a Star SAS 
              et est protégé par les lois sur la propriété intellectuelle.
            </p>
            <p className="mt-2">
              Toute reproduction, même partielle, est interdite sans autorisation préalable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Protection des Données Personnelles</h2>
            <p>
              {/* TODO: Replace with real DPO contact */}
              <strong>Délégué à la Protection des Données (DPO):</strong><br />
              Email: <a href="mailto:dpo@callastar.com" className="text-purple-600 hover:underline">dpo@callastar.com</a>
            </p>
            <p className="mt-2">
              Pour plus d'informations, consultez notre <a href="/legal/privacy" className="text-purple-600 hover:underline">Politique de Confidentialité</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Cookies</h2>
            <p>
              Ce site utilise des cookies nécessaires au fonctionnement de la plateforme (authentification, préférences).
              {/* TODO: Implement cookie management */}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Loi Applicable et Juridiction</h2>
            <p>
              {/* TODO: Confirm jurisdiction */}
              Les présentes mentions légales sont régies par le droit français. 
              En cas de litige, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Crédits</h2>
            <p>
              {/* TODO: Add design/development credits if needed */}
              Design et développement: Call a Star Team
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
