# Guide du Booking de Test - Callastar

## 🎯 Objectif

Le système de booking de test permet aux développeurs de tester les fonctionnalités d'appel vidéo à tout moment, sans contraintes de date/heure et sans impacter les données de production.

## 🚀 Initialisation du Booking de Test

### Méthode 1 : Via Script (Recommandé)

```bash
# Installer les dépendances si ce n'est pas déjà fait
npm install

# Exécuter le script d'initialisation
npx ts-node scripts/init-test-booking.ts
```

### Méthode 2 : Via API Route

```bash
# En mode développement, faites une requête POST
curl -X POST http://localhost:3000/api/test-booking/init
```

## 📋 Informations d'Accès

Après l'initialisation, vous aurez accès à :

### 👤 Compte Utilisateur Test
- **Email**: `test-user@callastar.dev`
- **Mot de passe**: `TestPassword123!`
- **Dashboard**: http://localhost:3000/dashboard/user/calls

### 🎨 Compte Créateur Test
- **Email**: `test-creator@callastar.dev`
- **Mot de passe**: `TestPassword123!`
- **Dashboard**: http://localhost:3000/dashboard/creator/calls

## 🧪 Fonctionnalités du Mode Test

### Identification Visuelle
- Badge **🧪 Mode Test** visible sur tous les dashboards
- Indicateur **"Mode Test"** pendant l'appel
- Message informatif dans l'interface d'appel

### Accès Immédiat
- ✅ Pas de contrainte temporelle (pas besoin d'attendre 15 minutes)
- ✅ Bouton "Rejoindre l'appel" toujours actif
- ✅ Pas de limite de durée (l'appel ne se termine pas automatiquement)

### Isolation de Production
- ✅ Flag `isTestBooking: true` dans la base de données
- ✅ Prix symbolique (0.50 EUR)
- ✅ Pas d'impact sur les paiements réels
- ✅ Visible uniquement en mode développement

## 🔧 Configuration Daily.co

Le booking de test utilise une salle Daily.co dédiée : `test-dev-call-room`

Vous devez :
1. Créer cette salle dans votre compte Daily.co
2. OU configurer l'API Daily.co pour créer la salle automatiquement

```bash
# Assurez-vous que DAILY_API_KEY est configuré dans .env
DAILY_API_KEY="votre-clé-api-daily"
```

## 📊 Structure en Base de Données

### Nouvelle Colonne
```sql
-- Migration ajoutée automatiquement
ALTER TABLE "Booking" ADD COLUMN "isTestBooking" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Booking_isTestBooking_idx" ON "Booking"("isTestBooking");
```

### Entités Créées
- 1 Utilisateur test
- 1 Créateur test avec profil
- 1 Offre d'appel test (date: 2099-12-31)
- 1 Booking test confirmé

## 🧹 Réinitialisation

Pour réinitialiser le booking de test :

```bash
# Relancer le script d'initialisation
npx ts-node scripts/init-test-booking.ts

# OU via l'API
curl -X POST http://localhost:3000/api/test-booking/init
```

Cela supprimera l'ancien booking et en créera un nouveau.

## 📖 Vérification du Booking

### Via API
```bash
# Obtenir les infos du booking de test
curl http://localhost:3000/api/test-booking/init
```

### Via Base de Données
```sql
-- Trouver tous les bookings de test
SELECT * FROM "Booking" WHERE "isTestBooking" = true;
```

## ⚠️ Sécurité

- ✅ Routes de test accessibles uniquement en mode `NODE_ENV !== 'production'`
- ✅ Comptes de test avec emails `.dev`
- ✅ Flag clair dans la base de données
- ✅ Pas d'intégration avec Stripe pour les bookings de test

## 🧪 Tests à Effectuer

Avec le booking de test, vous pouvez tester :

1. **Interface d'appel**
   - Affichage pré-appel
   - Test caméra/micro
   - Rejoindre l'appel

2. **Daily.co Integration**
   - Connexion à la salle vidéo
   - Qualité audio/vidéo
   - Commandes (mute, camera off, etc.)

3. **Logs d'Appel**
   - Enregistrement des événements
   - API `/api/call-logs`
   - Récupération du résumé d'appel

4. **Dashboards**
   - Vue utilisateur
   - Vue créateur
   - Affichage des badges

## 🐛 Dépannage

### Le booking n'apparaît pas dans le dashboard
- Vérifiez que vous êtes connecté avec le bon compte
- Rafraîchissez la page
- Vérifiez les logs du serveur

### L'appel ne se lance pas
- Vérifiez que la salle Daily.co existe
- Vérifiez votre clé API Daily.co dans `.env`
- Consultez la console du navigateur pour les erreurs

### Erreur 500 sur /api/call-logs
- Vérifiez que `npm install` a été exécuté
- Vérifiez que Prisma est à jour : `npx prisma generate`

## 📚 Fichiers Modifiés

### Nouveaux Fichiers
- `scripts/init-test-booking.ts`
- `app/api/test-booking/init/route.ts`
- `TEST_BOOKING_GUIDE.md`

### Fichiers Modifiés
- `prisma/schema.prisma` (ajout de `isTestBooking`)
- `app/api/call-logs/route.ts` (amélioration validation)
- `app/dashboard/user/calls/page.tsx` (badge + accès immédiat)
- `app/dashboard/creator/calls/page.tsx` (badge + accès immédiat)
- `app/call/[bookingId]/page.tsx` (mode test + badge)

## 💡 Bonnes Pratiques

1. **Toujours utiliser les comptes de test** pour le développement
2. **Ne jamais commiter** les fichiers `.env` avec vraies clés
3. **Documenter** tout changement dans ce guide
4. **Nettoyer** les logs de test régulièrement

---

*Dernière mise à jour : 28 décembre 2024*
