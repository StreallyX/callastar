# Migration Notes - Amélioration Booking Call Experience

## Changements du schéma Prisma

Cette branche (`feature/booking-call-experience`) inclut des modifications importantes au schéma Prisma qui nécessitent une migration de base de données.

### Nouveaux champs ajoutés :

#### Model `User`
- `timezone` (String, default: "Europe/Paris") - Fuseau horaire de l'utilisateur au format IANA

#### Model `Creator`
- `timezone` (String, default: "Europe/Paris") - Fuseau horaire du créateur au format IANA
- `bannerImage` (String?, nullable) - URL de l'image de bannière du profil
- `socialLinks` (Json?, nullable) - Liens vers les réseaux sociaux (Instagram, TikTok, Twitter, YouTube, etc.)

### Migration requise

Avant de déployer ces changements en production, vous devez exécuter la migration Prisma :

```bash
# Générer la migration
npx prisma migrate dev --name add-timezone-banner-social-links

# OU en production
npx prisma migrate deploy
```

### Valeurs par défaut

Les champs ajoutés ont des valeurs par défaut, donc la migration devrait être safe pour les données existantes :
- `timezone` : "Europe/Paris" pour tous les utilisateurs et créateurs existants
- `bannerImage` : NULL (les créateurs peuvent l'ajouter plus tard)
- `socialLinks` : NULL (les créateurs peuvent l'ajouter plus tard)

### Rétro-compatibilité

Le code est conçu pour être rétro-compatible :
- Si `timezone` n'est pas défini, le système utilise la détection automatique côté client
- Si `bannerImage` est NULL, l'interface affiche simplement la photo de profil sans bannière
- Si `socialLinks` est NULL, les boutons de réseaux sociaux ne sont pas affichés

## Instructions de déploiement

1. Merger la Pull Request
2. Déployer le code sur l'environnement de staging/production
3. Exécuter `npx prisma migrate deploy`
4. Vérifier que la migration s'est bien déroulée
5. Tester les nouvelles fonctionnalités

## Rollback

En cas de problème, vous pouvez rollback la migration :

```bash
# Revenir à la migration précédente
npx prisma migrate resolve --rolled-back <migration-name>
```

Cependant, notez que les nouvelles fonctionnalités ne fonctionneront pas sans les champs ajoutés au schéma.
