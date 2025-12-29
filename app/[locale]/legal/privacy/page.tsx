import { getTranslations } from 'next-intl/server';
import { Navbar } from '@/components/navbar';

export default async function PrivacyPage() {
  const t = await getTranslations('legal.privacy');

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
          {/* TODO: Replace all fictional information with real data */}
          
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Responsable du Traitement</h2>
            <p>
              {/* TODO: Replace with real company name */}
              <strong>Entité:</strong> Call a Star SAS<br />
              {/* TODO: Replace with real DPO contact */}
              <strong>DPO (Délégué à la Protection des Données):</strong> dpo@callastar.com
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Conformité RGPD</h2>
            <p>
              Cette politique de confidentialité est conforme au Règlement Général sur la Protection des Données (RGPD) 
              et garantit la protection de vos données personnelles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Données Collectées</h2>
            <h3 className="text-xl font-semibold mb-2">3.1. Données d'Authentification</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nom complet</li>
              <li>Adresse email</li>
              <li>Mot de passe (crypté)</li>
              <li>Méthode d'authentification (email/Google OAuth)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2 mt-4">3.2. Données de Paiement</h3>
            <p>
              Les données de paiement sont traitées exclusivement par <strong>Stripe</strong>. 
              Nous ne stockons jamais vos informations bancaires complètes sur nos serveurs.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Identifiant Stripe Customer</li>
              <li>Historique des transactions</li>
              <li>Statuts de paiement</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2 mt-4">3.3. Données d'Appels</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Date et heure des appels</li>
              <li>Durée des appels</li>
              <li>Logs techniques (connexion, déconnexion)</li>
              <li>Métadonnées de session (Daily.co)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Finalités du Traitement</h2>
            <p>Vos données sont utilisées pour:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Créer et gérer votre compte</li>
              <li>Traiter les paiements et réservations</li>
              <li>Faciliter les appels vidéo</li>
              <li>Améliorer nos services</li>
              <li>Respecter nos obligations légales</li>
              <li>Prévenir la fraude</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Partage de Données</h2>
            <p>Nous partageons vos données uniquement avec:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Stripe:</strong> Pour le traitement des paiements</li>
              <li><strong>Daily.co:</strong> Pour la gestion des appels vidéo</li>
              <li><strong>Google (si connexion OAuth):</strong> Pour l'authentification</li>
            </ul>
            <p className="mt-2">
              Nous ne vendons jamais vos données personnelles à des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Durée de Conservation</h2>
            <p>
              {/* TODO: Define precise retention periods */}
              - Données de compte: Conservées tant que le compte est actif<br />
              - Données de paiement: Conservées conformément aux obligations légales (10 ans)<br />
              - Logs d'appels: Conservés pendant 1 an
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Vos Droits (RGPD)</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Droit d'accès:</strong> Obtenir une copie de vos données</li>
              <li><strong>Droit de rectification:</strong> Corriger des données inexactes</li>
              <li><strong>Droit à l'effacement:</strong> Supprimer vos données</li>
              <li><strong>Droit à la portabilité:</strong> Recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition:</strong> Vous opposer au traitement de vos données</li>
              <li><strong>Droit de limitation:</strong> Limiter le traitement de vos données</li>
            </ul>
            <p className="mt-4">
              Pour exercer ces droits, contactez-nous à: {/* TODO: Replace with real DPO email */}
              <a href="mailto:dpo@callastar.com" className="text-purple-600 hover:underline">dpo@callastar.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cryptage SSL/TLS</li>
              <li>Mots de passe hashés (bcrypt)</li>
              <li>Accès restreint aux données</li>
              <li>Audits de sécurité réguliers {/* TODO: Implement regular audits */}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
            <p>
              {/* TODO: Implement cookie consent banner */}
              Nous utilisons des cookies essentiels pour le fonctionnement de la plateforme (authentification, session).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Modifications</h2>
            <p>
              Cette politique peut être mise à jour. Nous vous notifierons des changements importants par email.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
