# 💰 Correction : Synchronisation de Devise Stripe Connect

**Date :** 28 décembre 2025  
**Branche :** `fix/stripe-currency-sync`  
**Problème :** Incohérence entre la devise du compte Stripe Connect et la devise enregistrée en base de données

---

## 🔴 Problème Identifié

### Symptômes
- Les créateurs connectent leur compte Stripe Connect Express dans une devise (ex: CHF, GBP)
- La base de données conserve la devise par défaut (EUR) dans `creator.currency`
- Les payouts échouent avec l'erreur : **"Solde non trouvé dans la devise EUR"**
- Le système cherche un solde EUR alors que Stripe renvoie le solde dans la devise réelle du compte

### Cause Racine
1. **Flux OAuth incomplet** : La devise n'était pas récupérée et persistée lors de l'onboarding Stripe
2. **Valeur par défaut EUR** : Les créateurs existants gardaient la valeur par défaut `EUR` même après configuration Stripe
3. **Devise codée en dur** : Certains endpoints utilisaient `'EUR'` en dur au lieu de `creator.currency`
4. **Absence de détection** : Aucun log pour alerter sur les incohérences de devise

---

## ✅ Solutions Implémentées

### 1. 📝 Script de Migration : `scripts/fix-currency-sync.ts`

**Objectif :** Corriger tous les créateurs existants en une seule fois

**Fonctionnalités :**
- ✅ Récupère la devise réelle de chaque compte Stripe Connect (`default_currency`)
- ✅ Met à jour `creator.currency` si différent
- ✅ Gère les erreurs (compte inexistant, API indisponible)
- ✅ Génère un rapport détaillé des corrections effectuées
- ✅ Supporte correction d'un créateur spécifique ou de tous les créateurs

**Usage :**
```bash
# Corriger tous les créateurs
npx ts-node scripts/fix-currency-sync.ts

# Corriger un créateur spécifique
npx ts-node scripts/fix-currency-sync.ts cm1abc123xyz
```

**Exemple de sortie :**
```
🚀 Démarrage de la synchronisation des devises...

📊 Nombre total de créateurs : 15
📊 Créateurs avec compte Stripe : 12

✅ Créateur cm1abc123xyz (John Doe) : EUR → CHF
⏭️  Créateur cm2def456uvw (Jane Smith) : EUR (déjà correct)

================================================================================
📋 RAPPORT DE SYNCHRONISATION
================================================================================

✅ Mis à jour        : 8
⏭️  Déjà correct      : 4
❌ Erreurs          : 0
📊 Total            : 12

✅ Synchronisation terminée !
```

---

### 2. 🔗 Endpoint Admin : `/api/admin/sync-currency`

**Objectif :** Permettre la resynchronisation depuis le dashboard admin

#### POST - Resynchroniser
```bash
# Tous les créateurs
POST /api/admin/sync-currency
Content-Type: application/json
{
  "creatorId": null  # ou omis
}

# Un créateur spécifique
POST /api/admin/sync-currency
Content-Type: application/json
{
  "creatorId": "cm1abc123xyz"
}
```

**Réponse :**
```json
{
  "success": true,
  "summary": {
    "total": 12,
    "updated": 8,
    "skipped": 4,
    "errors": 0
  },
  "results": [
    {
      "creatorId": "cm1abc123xyz",
      "creatorName": "John Doe",
      "creatorEmail": "john@example.com",
      "stripeAccountId": "acct_xxx",
      "oldCurrency": "EUR",
      "newCurrency": "CHF",
      "updated": true
    }
    // ... autres résultats
  ]
}
```

#### GET - Vérifier les incohérences (dry-run)
```bash
GET /api/admin/sync-currency
```

**Réponse :**
```json
{
  "success": true,
  "totalCreators": 12,
  "inconsistenciesFound": 8,
  "inconsistencies": [
    {
      "creatorId": "cm1abc123xyz",
      "creatorName": "John Doe",
      "creatorEmail": "john@example.com",
      "stripeAccountId": "acct_xxx",
      "dbCurrency": "EUR",
      "stripeCurrency": "CHF"
    }
    // ... autres incohérences
  ]
}
```

**Sécurité :** Endpoint protégé - Accessible uniquement aux administrateurs

---

### 3. 🔧 Améliorations du Flux OAuth

**Fichier :** `app/api/stripe/connect-onboard/route.ts`

#### Changements :
- ✅ **GET /api/stripe/connect-onboard** : Récupère automatiquement la devise lors de la vérification du statut
- ✅ **Synchronisation automatique** : Met à jour `creator.currency` si différent de Stripe
- ✅ **Logs améliorés** : Affiche clairement les mises à jour de devise

**Logs ajoutés :**
```
[connect-onboard] ✅ Créateur cm1abc123xyz mis à jour:
  - Statut onboarding: false → true
  - Devise: EUR → CHF
```

---

### 4. ⚠️ Détection d'Incohérence dans les Opérations Financières

#### Fichier : `app/api/stripe/balance/[creatorId]/route.ts`
**Changement :**
- ✅ Compare `creator.currency` (DB) vs `stripeAccount.default_currency` (Stripe)
- ✅ Log un warning si incohérence détectée
- ✅ Retourne `creator.currency` au lieu de `'EUR'` en dur

**Logs ajoutés :**
```
[balance] ⚠️  INCOHÉRENCE DEVISE DÉTECTÉE pour créateur cm1abc123xyz (John Doe):
  - Base de données : EUR
  - Compte Stripe   : CHF
  → Action requise : Resynchroniser via /api/admin/sync-currency
```

#### Fichier : `app/api/admin/payouts/trigger/route.ts`
**Changements :**
- ✅ Utilise `creator.currency` au lieu de forcer `'eur'`
- ✅ Supprime la validation `if (currency !== 'eur')`
- ✅ Log un warning si incohérence détectée
- ✅ Messages d'erreur avec la devise correcte au lieu de `€` en dur

**Logs ajoutés :**
```
[payout-trigger] ⚠️  INCOHÉRENCE DEVISE DÉTECTÉE pour créateur cm1abc123xyz (John Doe):
  - Base de données : EUR
  - Compte Stripe   : CHF
  → Action requise : Resynchroniser via /api/admin/sync-currency
```

**Exemple d'erreur améliorée :**
```
Avant : Solde disponible: 50.00€, Montant demandé: 100.00€
Après : Solde disponible: 50.00 CHF, Montant demandé: 100.00 CHF
```

---

### 5. 📊 Fonction Utilitaire Améliorée

**Fichier :** `lib/stripe.ts`

**Fonction :** `getCreatorCurrencyByStripeAccount()`

**Améliorations :**
- ✅ Logs détaillés à chaque étape
- ✅ Cache la devise récupérée en DB
- ✅ Gestion d'erreurs améliorée

**Logs ajoutés :**
```
[getCreatorCurrencyByStripeAccount] Devise trouvée en DB pour acct_xxx: CHF
[getCreatorCurrencyByStripeAccount] Récupération de la devise depuis Stripe pour acct_xxx...
[getCreatorCurrencyByStripeAccount] Devise récupérée depuis Stripe: CHF
[getCreatorCurrencyByStripeAccount] ✅ Devise mise à jour en DB pour créateur cm1abc123xyz: CHF
```

---

## 📋 Fichiers Modifiés

### Nouveaux Fichiers
1. ✅ `scripts/fix-currency-sync.ts` - Script de migration
2. ✅ `app/api/admin/sync-currency/route.ts` - Endpoint admin
3. ✅ `CORRECTION_SYNCHRONISATION_DEVISE.md` - Cette documentation

### Fichiers Modifiés
1. ✅ `app/api/stripe/connect-onboard/route.ts` - Flux OAuth amélioré
2. ✅ `app/api/stripe/balance/[creatorId]/route.ts` - Détection d'incohérence + utilise `creator.currency`
3. ✅ `app/api/admin/payouts/trigger/route.ts` - Détection d'incohérence + supprime validation EUR forcée
4. ✅ `lib/stripe.ts` - Logs améliorés dans `getCreatorCurrencyByStripeAccount()`

---

## 🚀 Plan de Déploiement

### Étape 1 : Tester en Local
```bash
# Créer un fichier .env.local avec les clés Stripe de test
STRIPE_SECRET_KEY=sk_test_...

# Exécuter le script de synchronisation
npx ts-node scripts/fix-currency-sync.ts
```

### Étape 2 : Déployer en Production
1. **Merge la branche** `fix/stripe-currency-sync` vers `main`
2. **Déployer** l'application
3. **Exécuter le script** de migration sur la production :
   ```bash
   npx ts-node scripts/fix-currency-sync.ts
   ```
4. **Vérifier les logs** pour confirmer les corrections

### Étape 3 : Surveillance Continue
1. **Monitorer les logs** des endpoints financiers
2. **Utiliser** `GET /api/admin/sync-currency` périodiquement pour détecter les incohérences
3. **Resynchroniser** si nécessaire via `POST /api/admin/sync-currency`

---

## 🔍 Vérification Post-Déploiement

### Checklist
- [ ] Le script de migration s'exécute sans erreur
- [ ] Tous les créateurs avec compte Stripe ont la bonne devise
- [ ] Les payouts fonctionnent correctement
- [ ] Les logs de détection d'incohérence n'apparaissent plus
- [ ] L'endpoint admin `/api/admin/sync-currency` fonctionne
- [ ] Le flux OAuth met à jour automatiquement la devise

### Commandes de Vérification
```bash
# Vérifier les incohérences restantes
curl -X GET https://your-domain.com/api/admin/sync-currency \
  -H "Authorization: Bearer <admin-token>"

# Vérifier les logs serveur
# Rechercher : "[balance]", "[payout-trigger]", "[connect-onboard]"
```

---

## 📚 Ressources

### Documentation Stripe
- [Stripe Connect Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Account Object - default_currency](https://stripe.com/docs/api/accounts/object#account_object-default_currency)
- [Multi-Currency Support](https://stripe.com/docs/currencies)

### Code Interne
- `prisma/schema.prisma` - Schéma de la table `creator`
- `lib/stripe.ts` - Fonctions utilitaires Stripe
- `lib/stripe-account-validator.ts` - Validation des comptes Stripe

---

## 🎯 Résultat Attendu

### Avant la Correction ❌
```
Créateur : John Doe
Compte Stripe : acct_xxx (CHF)
Base de données : creator.currency = "EUR"
Résultat : ❌ Payout échoue - "Solde non trouvé dans la devise EUR"
```

### Après la Correction ✅
```
Créateur : John Doe
Compte Stripe : acct_xxx (CHF)
Base de données : creator.currency = "CHF"
Résultat : ✅ Payout réussit - Solde trouvé en CHF
```

---

## 🤝 Support

En cas de problème :
1. **Vérifier les logs serveur** pour les messages `[sync-currency]`, `[balance]`, `[payout-trigger]`
2. **Utiliser l'endpoint de vérification** : `GET /api/admin/sync-currency`
3. **Resynchroniser manuellement** via : `POST /api/admin/sync-currency`
4. **Exécuter le script** : `npx ts-node scripts/fix-currency-sync.ts`

---

## ✅ Conclusion

Cette correction résout définitivement le problème de synchronisation de devise en :
1. ✅ Corrigeant les créateurs existants (script + endpoint admin)
2. ✅ Synchronisant automatiquement lors de l'onboarding
3. ✅ Détectant les incohérences futures avec des logs clairs
4. ✅ Utilisant la devise correcte dans toutes les opérations financières

**Stripe est maintenant la source de vérité pour la devise.**
