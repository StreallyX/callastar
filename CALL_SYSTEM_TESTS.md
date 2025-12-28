# Tests de Résilience du Système d'Appel Callastar

Ce document décrit tous les tests à effectuer pour valider la résilience du système d'appel.

## ✅ Checklist de Tests

### 1. Tests Fonctionnels de Base

#### Test 1.1 : Accès à l'appel
- [ ] Un utilisateur ne peut pas accéder à l'appel plus de 15 minutes avant l'heure prévue
- [ ] Un utilisateur peut accéder à l'appel 15 minutes avant l'heure prévue
- [ ] Les bookings de test (isTestBooking: true) sont accessibles immédiatement
- [ ] Le countdown s'affiche correctement et s'actualise en temps réel

#### Test 1.2 : Phase pré-appel
- [ ] La section "Règles de l'appel" s'affiche correctement
- [ ] Le test de caméra/micro fonctionne
- [ ] Le branding Callastar est visible
- [ ] Le bouton "Rejoindre l'appel" fonctionne
- [ ] Les métadonnées (durée, créateur, etc.) sont correctes

#### Test 1.3 : Phase d'appel
- [ ] L'interface Daily.co se charge correctement
- [ ] Le callId s'affiche en haut à gauche
- [ ] Le branding Callastar est visible pendant l'appel
- [ ] Le timer affiche le temps écoulé
- [ ] Le temps restant s'affiche (sauf pour les bookings de test)
- [ ] Les contrôles (caméra, micro, quitter, plein écran) fonctionnent

#### Test 1.4 : Fin d'appel normale
- [ ] Le bouton "Quitter l'appel" fonctionne
- [ ] L'appel se termine automatiquement quand le temps est écoulé (sauf test bookings)
- [ ] Redirection automatique vers la page summary
- [ ] Le summary affiche les bonnes informations

### 2. Tests de Logging Exhaustif

#### Test 2.1 : Événements lifecycle
- [ ] PRE_CALL_ENTERED est loggé quand l'utilisateur arrive sur la page pré-appel
- [ ] CALL_JOIN est loggé quand l'utilisateur rejoint l'appel
- [ ] SESSION_START est loggé au début de chaque session
- [ ] SESSION_END est loggé à la fin de chaque session
- [ ] CALL_LEAVE est loggé quand l'utilisateur quitte
- [ ] CALL_END est loggé quand l'appel est définitivement terminé

#### Test 2.2 : Événements média
- [ ] CAMERA_TOGGLED est loggé à chaque activation/désactivation de caméra
- [ ] MIC_TOGGLED est loggé à chaque activation/désactivation de micro

#### Test 2.3 : Événements UI
- [ ] FULLSCREEN_ENTERED est loggé à l'entrée en plein écran
- [ ] FULLSCREEN_EXITED est loggé à la sortie du plein écran
- [ ] SUMMARY_VIEW est loggé quand l'utilisateur consulte le summary

#### Test 2.4 : Événements participants
- [ ] PARTICIPANT_JOINED est loggé quand un participant rejoint
- [ ] PARTICIPANT_LEFT est loggé quand un participant quitte

#### Test 2.5 : Logs contiennent les bonnes métadonnées
- [ ] bookingId présent dans tous les logs
- [ ] callId présent dans les logs pendant l'appel
- [ ] actor (USER/CREATOR) correct
- [ ] timestamp correct
- [ ] metadata additionnelles pertinentes

### 3. Tests de Déconnexion/Reconnexion

#### Test 3.1 : Déconnexion volontaire
- [ ] L'utilisateur clique sur "Quitter l'appel"
- [ ] DISCONNECTION_VOLUNTARY est loggé
- [ ] SESSION_END est loggé avec la durée correcte
- [ ] Redirection vers le summary
- [ ] Le summary affiche la durée correcte

#### Test 3.2 : Déconnexion involontaire - Refresh page
- [ ] L'utilisateur rafraîchit la page pendant l'appel
- [ ] DISCONNECTION_INVOLUNTARY est loggé (reason: page-unload)
- [ ] L'utilisateur peut rejoindre immédiatement
- [ ] CALL_RECONNECT est loggé
- [ ] La durée est cumulée correctement

#### Test 3.3 : Déconnexion involontaire - Fermeture onglet
- [ ] L'utilisateur ferme l'onglet pendant l'appel
- [ ] Un warning est affiché ("Êtes-vous sûr de vouloir quitter ?")
- [ ] Si confirmation : DISCONNECTION_INVOLUNTARY loggé
- [ ] L'appel reste actif côté système
- [ ] L'utilisateur peut rejoindre à nouveau

#### Test 3.4 : Déconnexion involontaire - Perte réseau
- [ ] Simuler une perte de connexion réseau
- [ ] DISCONNECTION_INVOLUNTARY est loggé (reason: network-disconnected)
- [ ] Le message "Connexion perdue - Tentative de reconnexion..." s'affiche
- [ ] Quand le réseau revient : CALL_RECONNECT est loggé
- [ ] Message "Reconnecté" s'affiche
- [ ] L'appel continue normalement

#### Test 3.5 : Déconnexion involontaire - Tab en arrière-plan
- [ ] L'utilisateur change d'onglet pendant l'appel
- [ ] DISCONNECTION_INVOLUNTARY est loggé (reason: tab-hidden)
- [ ] Quand l'utilisateur revient : CALL_RECONNECT loggé
- [ ] L'appel continue normalement

#### Test 3.6 : Crash navigateur
- [ ] Simuler un crash navigateur (kill process)
- [ ] L'appel reste actif côté système
- [ ] L'utilisateur peut rejoindre immédiatement après redémarrage
- [ ] CALL_RECONNECT est loggé
- [ ] La durée est cumulée correctement

### 4. Tests de Sessions Multiples

#### Test 4.1 : Deux sessions simples
1. L'utilisateur rejoint l'appel → quitte après 2 minutes
2. L'utilisateur rejoint à nouveau → reste 3 minutes → quitte
- [ ] Le summary affiche "2 sessions"
- [ ] La durée totale cumulée est 5 minutes
- [ ] Les deux sessions sont listées avec leurs durées individuelles
- [ ] Le statut est "completed-multiple-sessions"

#### Test 4.2 : Trois sessions avec déconnexions involontaires
1. Session 1 : 1 minute puis refresh page (involontaire)
2. Session 2 : 2 minutes puis perte réseau (involontaire)
3. Session 3 : 2 minutes puis quit volontaire
- [ ] Le summary affiche "3 sessions"
- [ ] La durée totale cumulée est 5 minutes
- [ ] Toutes les sessions sont listées
- [ ] Les logs montrent les différents types de déconnexion

#### Test 4.3 : Interleaved sessions (créateur et fan)
- Créateur rejoint → Fan rejoint → Créateur quitte → Fan continue → Fan quitte
- [ ] Les logs distinguent bien les actors (CREATOR vs USER)
- [ ] Les sessions de chaque participant sont trackées séparément
- [ ] Le summary cumule correctement

### 5. Tests du Summary Dynamique

#### Test 5.1 : Summary après appel normal (une session)
- [ ] Status: "completed"
- [ ] Durée affichée correcte
- [ ] Heure de début/fin correctes
- [ ] Efficacité calculée correctement (% de la durée prévue)
- [ ] Participants corrects
- [ ] Chronologie complète des événements

#### Test 5.2 : Summary après sessions multiples
- [ ] Status: "completed-multiple-sessions"
- [ ] Durée totale cumulée correcte
- [ ] Section "Sessions d'appel" affichée
- [ ] Chaque session listée avec sa durée
- [ ] Message explicatif présent

#### Test 5.3 : Summary pendant appel en cours
- [ ] Status: "in-progress"
- [ ] Durée affichée en temps réel
- [ ] Message indiquant que l'appel est en cours

#### Test 5.4 : Summary pour no-show
- [ ] Status: "no-show"
- [ ] Aucune durée affichée
- [ ] Message approprié

#### Test 5.5 : Recalcul dynamique
- [ ] Le summary est TOUJOURS calculé à partir des logs
- [ ] Actualiser la page recalcule à partir des logs
- [ ] Aucune donnée de summary n'est stockée en base

### 6. Tests d'État d'Appel

#### Test 6.1 : État WAITING
- [ ] Avant 15 minutes de l'heure prévue
- [ ] Countdown visible
- [ ] Boutons appropriés (Retour dashboard, Actualiser)

#### Test 6.2 : État ACTIVE
- [ ] Pendant l'appel
- [ ] Interface complète visible
- [ ] Tous les contrôles fonctionnels

#### Test 6.3 : État ENDED
- [ ] Après la fin de l'appel
- [ ] Message "Appel terminé"
- [ ] Redirection automatique vers summary

### 7. Tests d'Erreurs

#### Test 7.1 : Erreur token Daily.co
- [ ] Simuler un échec d'obtention du token
- [ ] CALL_ERROR loggé avec le détail
- [ ] Message d'erreur approprié
- [ ] Bouton "Réessayer" fonctionnel

#### Test 7.2 : Erreur connexion Daily.co
- [ ] Simuler une erreur de connexion à Daily.co
- [ ] CALL_ERROR loggé
- [ ] Message d'erreur clair
- [ ] Options de récupération

#### Test 7.3 : Booking introuvable
- [ ] URL avec bookingId invalide
- [ ] Erreur 404 appropriée
- [ ] Message clair
- [ ] Bouton retour dashboard

### 8. Tests de Performance

#### Test 8.1 : Logs volumétriques
- [ ] 100+ événements loggés pendant un appel
- [ ] Le summary se charge rapidement
- [ ] La chronologie s'affiche correctement
- [ ] Pas de ralentissement

#### Test 8.2 : Nombreuses sessions
- [ ] 10+ sessions dans un seul appel
- [ ] Le summary calcule correctement
- [ ] La liste des sessions s'affiche bien
- [ ] Performance acceptable

### 9. Tests de Sécurité

#### Test 9.1 : Accès non autorisé
- [ ] Un utilisateur non autorisé ne peut pas accéder à l'appel
- [ ] Un utilisateur non autorisé ne peut pas voir le summary
- [ ] Erreur 403 appropriée

#### Test 9.2 : Validation des inputs
- [ ] Les logs rejettent les données invalides
- [ ] Erreur 400 avec détails Zod si invalide

### 10. Tests UI/UX

#### Test 10.1 : Branding Callastar
- [ ] Logo/badge Callastar visible dans tous les états
- [ ] Couleurs et style cohérents

#### Test 10.2 : CallId visible
- [ ] CallId affiché en haut à gauche pendant l'appel
- [ ] Format court mais identifiable

#### Test 10.3 : Règles de l'appel
- [ ] Section bien visible dans pre-call
- [ ] Informations claires et complètes

#### Test 10.4 : Boutons de sortie
- [ ] Bouton "Quitter l'appel" bien visible
- [ ] Style clair (rouge, destructive)
- [ ] Pas d'ambiguïté

#### Test 10.5 : Gestion plein écran
- [ ] PAS de plein écran par défaut
- [ ] Bouton dédié pour entrer en plein écran
- [ ] Bouton pour sortir du plein écran
- [ ] Événements loggés

#### Test 10.6 : Responsive design
- [ ] Desktop : interface complète
- [ ] Mobile : interface adaptée
- [ ] Tablette : interface adaptée

### 11. Tests de Bookings de Test

#### Test 11.1 : Accès immédiat
- [ ] isTestBooking: true permet l'accès immédiat
- [ ] Badge "🧪 Mode Test" visible partout

#### Test 11.2 : Pas de limite de temps
- [ ] Le timer ne force pas la fin d'appel
- [ ] Temps restant non affiché
- [ ] L'appel peut durer indéfiniment

## 🔧 Commandes de Test

### Build du projet
```bash
cd /home/ubuntu/github_repos/callastar
npm run build
```

### Démarrer le serveur de dev
```bash
npm run dev
```

### Vérifier les types TypeScript
```bash
npx tsc --noEmit
```

### Tester les API routes
```bash
# Test call-logs
curl -X POST http://localhost:3000/api/call-logs \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"...", "event":"CALL_JOIN", "callId":"test-123"}'

# Test call-summary
curl http://localhost:3000/api/call-summary/[bookingId]
```

## 📊 Résultats Attendus

### Logs complets
Chaque appel doit générer au minimum :
- 1x PRE_CALL_ENTERED
- 1x CALL_JOIN (par participant)
- 1x SESSION_START
- Nx CAMERA_TOGGLED / MIC_TOGGLED (selon utilisation)
- 1x SESSION_END
- 1x CALL_LEAVE
- 1x SUMMARY_VIEW

### Summary précis
- Durée totale = somme de toutes les sessions
- Nombre de sessions correct
- Status approprié
- Chronologie complète

### Résilience
- Aucune perte de données lors de reconnexions
- Pas de double summary
- Cumul correct des durées
- État cohérent à tout moment

## ✅ Validation Finale

Tous les tests ci-dessus doivent passer pour considérer le système comme résilient et prêt pour la production.

Date de dernière mise à jour : 2025-12-28
