# Correction du Timer de l'Appel

## Problème Initial

Le timer de l'appel démarrait toujours à la durée totale (ou à 0) pour tous les participants, quelle que soit l'heure à laquelle ils rejoignaient l'appel. Cela créait une incohérence :

- Un participant rejoignant un appel de 30 minutes après 15 minutes voyait un timer à 30:00
- Le temps restant n'était pas calculé en fonction du début réel de l'appel
- Chaque participant avait sa propre "heure de début", causant des désynchronisations

## Solution Implémentée

### 1. Nouvelle API Route : `/api/call-start-time/[bookingId]`

**Fichier créé :** `app/api/call-start-time/[bookingId]/route.ts`

Cette API récupère l'heure de début réelle de l'appel en cherchant le premier événement `CALL_JOIN` dans les logs.

**Retour :**
```json
{
  "realStartTime": "2025-12-28T10:00:00.000Z",  // Heure du premier participant
  "scheduledStartTime": "2025-12-28T10:00:00.000Z",  // Heure prévue
  "hasStarted": true,  // L'appel a-t-il déjà commencé ?
  "isFirstParticipant": false,  // Le requérant est-il le premier ?
  "scheduledDuration": 30,  // Durée prévue en minutes
  "isTestBooking": false  // Booking de test ?
}
```

### 2. Modifications du Timer dans `page.tsx`

**Nouveaux states :**
```typescript
const [realCallStartTime, setRealCallStartTime] = useState<Date | null>(null);
const [isFirstParticipant, setIsFirstParticipant] = useState<boolean>(false);
```

**Logique de calcul du temps :**
```typescript
// Dans le useEffect du timer
if (realCallStartTime) {
  // L'appel a déjà commencé : calculer depuis le début réel
  elapsed = Math.floor((now - realCallStartTime.getTime()) / 1000);
} else if (sessionStartTimeRef.current) {
  // Premier participant : utiliser l'heure de session locale
  elapsed = Math.floor((now - sessionStartTimeRef.current.getTime()) / 1000);
}

const remaining = Math.max(0, scheduledDuration - elapsed);
```

**Appel de l'API avant de rejoindre :**
```typescript
// Dans joinCall()
const startTimeResponse = await fetch(`/api/call-start-time/${bookingId}`);
if (startTimeResponse.ok) {
  const startTimeData = await startTimeResponse.json();
  if (startTimeData.hasStarted && startTimeData.realStartTime) {
    setRealCallStartTime(new Date(startTimeData.realStartTime));
    setIsFirstParticipant(false);
  } else {
    setIsFirstParticipant(true);
  }
}
```

### 3. Gestion des Cas Particuliers

#### Premier Participant
- `isFirstParticipant = true`
- Le timer démarre à la durée totale
- `realCallStartTime` est défini au moment où il rejoint
- Cela devient l'heure de référence pour tous les autres participants

#### Participant en Retard
- L'API retourne `hasStarted = true` et l'heure de début réelle
- Le timer est initialisé avec le temps déjà écoulé
- Affichage d'un indicateur "(rejoint en cours)"

#### Reconnexion
- Même logique qu'un participant en retard
- L'heure de début réelle est récupérée à nouveau
- Le timer reprend au temps restant correct

#### Bookings de Test
- Pas de limite de temps
- Affichage "Mode Test - Pas de limite"
- Le timer continue indéfiniment

## Améliorations de l'Interface

### Indicateur Visuel
```tsx
{!isFirstParticipant && realCallStartTime && (
  <span className="text-xs text-yellow-300 ml-2">
    (rejoint en cours)
  </span>
)}
```

### Mode Test
```tsx
{booking?.isTestBooking && (
  <div className="text-xs text-blue-300 border-l border-gray-500 pl-4">
    Mode Test - Pas de limite
  </div>
)}
```

## Formule de Calcul

```
Temps écoulé = Maintenant - Heure de début réelle
Temps restant = Durée totale - Temps écoulé
```

## Scénarios de Test

### ✅ Scénario 1 : Premier participant
1. Utilisateur rejoint l'appel
2. API retourne `hasStarted = false`
3. Timer démarre à la durée totale (ex: 30:00)
4. `realCallStartTime` est défini maintenant

### ✅ Scénario 2 : Deuxième participant (en retard)
1. Utilisateur rejoint l'appel 10 minutes après le début
2. API retourne `hasStarted = true` avec l'heure de début
3. Timer démarre à 20:00 (temps restant réel)
4. Indicateur "(rejoint en cours)" affiché

### ✅ Scénario 3 : Reconnexion
1. Utilisateur quitte l'appel
2. Utilisateur rejoint l'appel
3. Timer reprend au temps restant correct
4. Pas de réinitialisation à la durée totale

### ✅ Scénario 4 : Booking de test
1. Utilisateur rejoint un booking de test
2. Timer compte le temps écoulé
3. Pas de limite de temps
4. Badge "🧪 Test" et message "Mode Test - Pas de limite"

## Avantages

1. **Cohérence** : Tous les participants voient le même temps restant
2. **Précision** : Le temps est calculé en fonction du début réel
3. **Fiabilité** : Gestion correcte des reconnexions
4. **Transparence** : Indicateurs visuels pour comprendre l'état
5. **Flexibilité** : Support des bookings de test sans limite

## Logs Améliorés

Les événements `CALL_JOIN` incluent maintenant :
```json
{
  "callId": "room-id",
  "roomUrl": "https://...",
  "isFirstParticipant": true
}
```

Cela permet de tracer précisément qui a rejoint en premier et quand.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Participant 1 rejoint à T0                     │
│  └─> CALL_JOIN logged                           │
│  └─> realCallStartTime = T0                     │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  Participant 2 rejoint à T0 + 10 min            │
│  └─> Fetch /api/call-start-time                 │
│  └─> Récupère realStartTime = T0                │
│  └─> Timer = 20:00 (30 - 10)                    │
└─────────────────────────────────────────────────┘
```

## Conclusion

Le timer affiche maintenant le temps restant réel pour tous les participants, calculé dynamiquement en fonction de l'heure de début réelle de l'appel. Cette correction est essentielle pour :
- La cohérence de l'expérience utilisateur
- La gestion correcte de la fin d'appel
- Le calcul fiable du temps total dans le summary
