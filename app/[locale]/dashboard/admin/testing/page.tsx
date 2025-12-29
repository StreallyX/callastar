'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, TestTube2, CreditCard, Video, Users, 
  Play, ExternalLink, Copy, Check, AlertTriangle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminTesting() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me');
      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'ADMIN') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success('Copié dans le presse-papier');
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <TestTube2 className="w-8 h-8" />
            Tests & Outils Admin
          </h1>
          <p className="text-gray-600">Testez et validez toutes les fonctionnalités de la plateforme</p>
        </div>

        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="accounts">Comptes de test</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="calls">Appels vidéo</TabsTrigger>
            <TabsTrigger value="stripe">Stripe</TabsTrigger>
          </TabsList>

          {/* Test Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Comptes de test disponibles
                </CardTitle>
                <CardDescription>
                  Utilisez ces comptes pour tester les différents rôles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Admin Account */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600">ADMIN</Badge>
                      <h4 className="font-semibold">Compte Administrateur</h4>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Email:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded">john@doe.com</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard('john@doe.com', 'admin-email')}
                        >
                          {copied === 'admin-email' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Mot de passe:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded">johndoe123</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard('johndoe123', 'admin-pass')}
                        >
                          {copied === 'admin-pass' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Creator Accounts */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-pink-600">CREATOR</Badge>
                      <h4 className="font-semibold">Comptes Créateurs (3)</h4>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[
                      { name: 'Emma', email: 'emma.creator@example.com', specialty: 'Musique' },
                      { name: 'Lucas', email: 'lucas.creator@example.com', specialty: 'Sport' },
                      { name: 'Sophie', email: 'sophie.creator@example.com', specialty: 'Comédie' }
                    ].map((creator) => (
                      <div key={creator.email} className="bg-gray-50 rounded p-3">
                        <div className="font-medium mb-2">{creator.name} - {creator.specialty}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Email:</span>
                            <div className="flex items-center gap-2">
                              <code className="bg-white px-2 py-1 rounded text-xs">{creator.email}</code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(creator.email, `creator-${creator.name}-email`)}
                              >
                                {copied === `creator-${creator.name}-email` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Mot de passe:</span>
                            <code className="bg-white px-2 py-1 rounded text-xs">password123</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Regular User */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">USER</Badge>
                      <h4 className="font-semibold">Compte Utilisateur</h4>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Email:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded">user@example.com</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard('user@example.com', 'user-email')}
                        >
                          {copied === 'user-email' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Mot de passe:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded">password123</code>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Actions rapides</h4>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.open('/auth/login', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ouvrir page de connexion
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.open('/auth/register', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Créer un nouveau compte
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Testing Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Test des paiements et transferts
                </CardTitle>
                <CardDescription>
                  Guide complet pour tester le flux de paiement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stripe Test Cards */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Cartes de test Stripe</h4>
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-800">Paiement réussi</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Numéro:</span>
                          <div className="flex items-center gap-2">
                            <code className="bg-white px-2 py-1 rounded">4242 4242 4242 4242</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard('4242424242424242', 'card-success')}
                            >
                              {copied === 'card-success' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date d'expiration:</span>
                          <code className="bg-white px-2 py-1 rounded">N'importe quelle date future</code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">CVC:</span>
                          <code className="bg-white px-2 py-1 rounded">N'importe quel 3 chiffres</code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="font-medium text-red-800">Paiement refusé</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Numéro:</span>
                          <code className="bg-white px-2 py-1 rounded">4000 0000 0000 0002</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Testing Flow */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">📋 Procédure de test complète</h4>
                  <ol className="space-y-3 text-sm list-decimal list-inside">
                    <li className="text-gray-700">
                      <strong>Connectez-vous en tant que créateur</strong> (emma.creator@example.com)
                    </li>
                    <li className="text-gray-700">
                      <strong>Créez une offre d'appel</strong> dans le dashboard créateur
                    </li>
                    <li className="text-gray-700">
                      <strong>Ouvrez un nouvel onglet en navigation privée</strong>
                    </li>
                    <li className="text-gray-700">
                      <strong>Connectez-vous en tant qu'utilisateur</strong> (user@example.com)
                    </li>
                    <li className="text-gray-700">
                      <strong>Réservez l'appel</strong> avec la carte de test Stripe
                    </li>
                    <li className="text-gray-700">
                      <strong>Vérifiez le statut de paiement:</strong>
                      <ul className="ml-6 mt-2 space-y-1">
                        <li>• Dashboard utilisateur: voir la réservation</li>
                        <li>• Dashboard créateur: voir la nouvelle réservation</li>
                        <li>• Onglet "Revenus": vérifier que le paiement est en statut "HELD"</li>
                        <li>• Admin dashboard: voir la transaction</li>
                      </ul>
                    </li>
                    <li className="text-gray-700">
                      <strong>Tester la période de sécurité (7 jours):</strong>
                      <ul className="ml-6 mt-2 space-y-1">
                        <li>• Le paiement reste en statut "HELD" pendant 7 jours</li>
                        <li>• Après 7 jours, il passe automatiquement en "READY"</li>
                        <li>• Pour tester immédiatement, modifier la date dans la base de données</li>
                      </ul>
                    </li>
                    <li className="text-gray-700">
                      <strong>Tester la demande de paiement:</strong>
                      <ul className="ml-6 mt-2 space-y-1">
                        <li>• Une fois en statut "READY", le créateur peut demander le paiement</li>
                        <li>• Cliquer sur "Demander le paiement" dans l'onglet Revenus</li>
                        <li>• Vérifier que le statut passe à "PAID"</li>
                        <li>• Vérifier dans Stripe Dashboard que le transfert a été créé</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                {/* Quick Test Actions */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚡ Actions de test rapides</h4>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        window.open('/creators', '_blank');
                        toast.success('Page créateurs ouverte');
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Commencer un test de réservation
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        window.open('/dashboard/admin', '_blank');
                        toast.success('Dashboard admin ouvert');
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir toutes les transactions (Admin)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Calls Testing Tab */}
          <TabsContent value="calls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Test des appels vidéo
                </CardTitle>
                <CardDescription>
                  Procédure complète pour tester les appels vidéo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prerequisites */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">📋 Prérequis</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Webcam et microphone fonctionnels</li>
                    <li>Deux navigateurs différents OU mode navigation privée</li>
                    <li>Une réservation confirmée (paiement effectué)</li>
                    <li>Daily.co API configurée (DAILY_API_KEY dans .env)</li>
                  </ul>
                </div>

                {/* Step by Step */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">🎬 Procédure de test étape par étape</h4>
                  <ol className="space-y-4 text-sm list-decimal list-inside">
                    <li className="text-gray-700">
                      <strong>Créer une réservation:</strong>
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Créez une offre d'appel pour une date/heure proche (ex: dans 5 minutes)</li>
                        <li>Réservez l'appel en tant qu'utilisateur</li>
                        <li>Complétez le paiement avec la carte de test Stripe</li>
                        <li>Attendez la confirmation par email (si RESEND_API_KEY configuré)</li>
                      </ul>
                    </li>
                    
                    <li className="text-gray-700 mt-3">
                      <strong>Préparer deux sessions:</strong>
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li><strong>Session 1 (Créateur):</strong> Navigateur normal avec compte créateur</li>
                        <li><strong>Session 2 (Utilisateur):</strong> Mode navigation privée OU autre navigateur avec compte utilisateur</li>
                      </ul>
                    </li>

                    <li className="text-gray-700 mt-3">
                      <strong>Accéder à l'appel:</strong>
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>L'accès est disponible 15 minutes avant l'heure programmée</li>
                        <li>Si vous essayez avant: message "L'accès à l'appel sera disponible dans X minutes"</li>
                        <li>Créateur: Dashboard → Appels → Cliquer sur "Rejoindre l'appel"</li>
                        <li>Utilisateur: Dashboard → Mes appels → Cliquer sur "Rejoindre l'appel"</li>
                      </ul>
                    </li>

                    <li className="text-gray-700 mt-3">
                      <strong>Tester les fonctionnalités vidéo:</strong>
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>✅ Vérifier que les deux participants se voient</li>
                        <li>✅ Tester l'audio bidirectionnel</li>
                        <li>✅ Tester le bouton muet (micro)</li>
                        <li>✅ Tester le bouton caméra (désactiver/activer vidéo)</li>
                        <li>✅ Vérifier le partage d'écran (si disponible)</li>
                        <li>✅ Tester la qualité vidéo et latence</li>
                        <li>✅ Tester la déconnexion/reconnexion</li>
                      </ul>
                    </li>

                    <li className="text-gray-700 mt-3">
                      <strong>Terminer l'appel:</strong>
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Fermer la fenêtre ou cliquer sur "Quitter l'appel"</li>
                        <li>Vérifier que le statut de la réservation passe à "COMPLETED"</li>
                        <li>L'utilisateur peut laisser un avis après l'appel</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                {/* Troubleshooting */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">⚠️ Résolution de problèmes</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong className="text-red-800">Pas de vidéo/audio:</strong>
                      <ul className="ml-4 mt-1 text-red-700 list-disc list-inside">
                        <li>Vérifier les autorisations du navigateur (webcam + micro)</li>
                        <li>Vérifier que le périphérique n'est pas utilisé par une autre app</li>
                        <li>Recharger la page et réautoriser les permissions</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-red-800">Erreur "Room not found":</strong>
                      <ul className="ml-4 mt-1 text-red-700 list-disc list-inside">
                        <li>Vérifier que DAILY_API_KEY est configuré</li>
                        <li>Vérifier que la réservation est confirmée (statut CONFIRMED)</li>
                        <li>Vérifier les logs serveur pour les erreurs Daily.co</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-red-800">"Accès non disponible":</strong>
                      <ul className="ml-4 mt-1 text-red-700 list-disc list-inside">
                        <li>L'appel n'est accessible que 15 min avant l'heure programmée</li>
                        <li>Modifier la date/heure de l'offre pour un test immédiat</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">🚀 Démarrage rapide</h4>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const url1 = window.open('/auth/login', '_blank');
                        setTimeout(() => {
                          window.open('/auth/login', '_blank');
                          toast.success('Deux fenêtres de connexion ouvertes');
                        }, 500);
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ouvrir 2 fenêtres de connexion
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.open('/dashboard/creator', '_blank')}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Dashboard Créateur (créer une offre)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stripe Testing Tab */}
          <TabsContent value="stripe" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Configuration et test Stripe Connect
                </CardTitle>
                <CardDescription>
                  Guide pour configurer et tester les comptes Stripe Connect
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stripe Dashboard Access */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">🔑 Accès au Dashboard Stripe</h4>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Pour voir et gérer les paiements, connectez-vous à votre compte Stripe:
                    </p>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ouvrir Stripe Dashboard
                    </Button>
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                      <strong>Sections importantes:</strong>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        <li>Paiements → Voir toutes les transactions</li>
                        <li>Connect → Gérer les comptes connectés (créateurs)</li>
                        <li>Webhooks → Configurer les endpoints</li>
                        <li>Développeurs → API keys et logs</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Stripe Connect Testing */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">🔗 Tester Stripe Connect</h4>
                  <ol className="space-y-3 text-sm list-decimal list-inside">
                    <li>
                      <strong>Connectez-vous en tant que créateur</strong> (emma.creator@example.com)
                    </li>
                    <li>
                      <strong>Cliquez sur "Configurer Stripe Connect"</strong> dans le dashboard
                    </li>
                    <li>
                      <strong>Complétez le formulaire Stripe</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Utilisez des données de test (Stripe détecte l'environnement de test)</li>
                        <li>Email: Utilisez l'email du créateur</li>
                        <li>IBAN de test: FR1420041010050500013M02606</li>
                        <li>Tous les autres champs: valeurs fictives acceptées</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Vérifiez la configuration</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Badge "Configuré" apparaît dans le dashboard</li>
                        <li>Alerte jaune disparaît</li>
                        <li>Onglet "Revenus" accessible avec fonctionnalité de paiement</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Voir dans Stripe Dashboard</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Aller dans Connect → Comptes</li>
                        <li>Le compte créateur apparaît dans la liste</li>
                        <li>Statut: "Charges enabled"</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                {/* Testing Payouts */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">💸 Tester les transferts (Payouts)</h4>
                  <ol className="space-y-3 text-sm list-decimal list-inside">
                    <li>
                      <strong>Créez une réservation payée</strong> (suivre la procédure "Paiements")
                    </li>
                    <li>
                      <strong>Vérifiez le statut initial</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Dashboard créateur → Revenus</li>
                        <li>Paiement en statut "HELD" (jaune)</li>
                        <li>Date de disponibilité affichée (+7 jours)</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Simuler l'écoulement du temps</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Option 1: Attendre 7 jours réels</li>
                        <li>Option 2: Modifier manuellement la date dans la base de données</li>
                        <li>Option 3: Appeler l'API de mise à jour: <code className="bg-gray-100 px-1 rounded">GET /api/payouts/update-status</code></li>
                      </ul>
                    </li>
                    <li>
                      <strong>Demander le paiement</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Le paiement passe en statut "READY" (violet)</li>
                        <li>Bouton "Demander le paiement" devient actif</li>
                        <li>Cliquer sur le bouton</li>
                        <li>Vérifier que le statut passe à "PAID" (vert)</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Vérifier dans Stripe Dashboard</strong>:
                      <ul className="ml-6 mt-2 space-y-1 list-disc">
                        <li>Aller dans Connect → Transferts</li>
                        <li>Le transfert apparaît avec le montant correct (prix - commission)</li>
                        <li>Statut: "Paid"</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                {/* Webhook Testing */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚙️ Configuration des Webhooks</h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    Les webhooks sont essentiels pour confirmer automatiquement les réservations après paiement.
                  </p>
                  <div className="space-y-2 text-sm text-yellow-700">
                    <strong>Pour l'environnement de développement:</strong>
                    <ul className="ml-4 mt-1 list-disc list-inside">
                      <li>Utilisez Stripe CLI: <code className="bg-yellow-100 px-1 rounded">stripe listen --forward-to localhost:3000/api/payments/webhook</code></li>
                      <li>OU utilisez ngrok pour exposer votre serveur local</li>
                    </ul>
                    <strong className="block mt-3">Pour la production:</strong>
                    <ul className="ml-4 mt-1 list-disc list-inside">
                      <li>Dashboard Stripe → Webhooks → Add endpoint</li>
                      <li>URL: <code className="bg-yellow-100 px-1 rounded">https://votre-domaine.com/api/payments/webhook</code></li>
                      <li>Événement: <code className="bg-yellow-100 px-1 rounded">payment_intent.succeeded</code></li>
                    </ul>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">🔗 Liens utiles</h4>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-sm"
                      onClick={() => window.open('https://stripe.com/docs/testing', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Documentation Stripe - Cartes de test
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-sm"
                      onClick={() => window.open('https://stripe.com/docs/connect', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Documentation Stripe Connect
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-sm"
                      onClick={() => window.open('https://dashboard.stripe.com/test/webhooks', '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Stripe Webhooks (Test mode)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
