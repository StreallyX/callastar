# 🚀 Démarrage Rapide - Booking de Test

## En 3 Minutes ⏱️

### 1. Installer et Configurer
```bash
cd /home/ubuntu/github_repos/callastar
npm install
npx prisma generate
```

### 2. Initialiser le Booking de Test
```bash
npx ts-node scripts/init-test-booking.ts
```

**Sortie attendue** :
```
🚀 Initialisation du booking de test...
✅ Utilisateur test: test-user@callastar.dev
✅ Créateur test: test-creator@callastar.dev
✅ Offre d'appel test créée
✅ Booking test créé

📋 Informations de connexion:
👤 Utilisateur: test-user@callastar.dev / TestPassword123!
🎨 Créateur: test-creator@callastar.dev / TestPassword123!
```

### 3. Démarrer le Serveur
```bash
npm run dev
```

### 4. Tester ! 🧪

**Option A : Côté Utilisateur**
1. Aller sur http://localhost:3000/auth/login
2. Se connecter : `test-user@callastar.dev` / `TestPassword123!`
3. Aller sur http://localhost:3000/dashboard/user/calls
4. Cliquer sur "Rejoindre" (accessible immédiatement !)

**Option B : Côté Créateur**
1. Se connecter : `test-creator@callastar.dev` / `TestPassword123!`
2. Aller sur http://localhost:3000/dashboard/creator/calls
3. Cliquer sur "Rejoindre"

---

## 🎯 Ce qui Change

### Avant ❌
- Attendre 15 minutes avant l'appel
- Créer un nouveau booking à chaque test
- Erreur 500 sur `/api/call-logs`
- Pas de moyen simple de tester

### Après ✅
- Accès **immédiat** au booking de test
- Badge "🧪 Mode Test" visible partout
- API call-logs **fonctionnelle**
- **Permanent** et **réutilisable**

---

## 🔧 Configuration Daily.co (Important !)

Vous devez créer la salle `test-dev-call-room` :

**Option 1 : Dashboard Daily.co**
1. https://dashboard.daily.co/
2. Create room → Name: `test-dev-call-room`

**Option 2 : API Daily.co**
```bash
curl --request POST \
  --url https://api.daily.co/v1/rooms \
  --header 'Authorization: Bearer YOUR_DAILY_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"name": "test-dev-call-room"}'
```

---

## 📖 Documentation Complète

- **Guide complet** : `TEST_BOOKING_GUIDE.md`
- **Récapitulatif** : `IMPLEMENTATION_RECAP.md`
- **Architecture** : `FEATURE_IMPLEMENTATION.md`

---

## 🐛 Problème ?

### Le booking n'apparaît pas
```bash
# Réinitialiser
npx ts-node scripts/init-test-booking.ts
```

### Erreur Daily.co
```bash
# Vérifier la config
echo $DAILY_API_KEY

# Créer la salle manuellement (voir ci-dessus)
```

### Erreur Zod
```bash
# Réinstaller les dépendances
npm install
npx prisma generate
```

---

## ✅ Checklist Rapide

- [ ] `npm install` exécuté
- [ ] Script d'init exécuté
- [ ] Salle Daily.co créée
- [ ] Serveur démarré
- [ ] Connexion test réussie
- [ ] Badge "🧪 Mode Test" visible
- [ ] Accès immédiat à l'appel

---

**🎉 Vous êtes prêt à tester les appels vidéo !**

*Questions ? Consultez TEST_BOOKING_GUIDE.md*
