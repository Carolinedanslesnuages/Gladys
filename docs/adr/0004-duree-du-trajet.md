# 0004 — Durée du trajet selon la vitesse réelle de la VSP

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Story** : #4 « Connaître mon vrai temps de trajet »

## Contexte
La durée donnée par un service d'itinéraire vaut pour une voiture ordinaire. Une voiture sans
permis roule à 45 km/h au plus. Il faut connaître la vitesse de chaque route du trajet.

## Options
- **A. Demander à l'IGN la vitesse de chaque route** (`waysAttributes=vitesse_moyenne_vl`, BD TOPO),
  dans les demandes déjà envoyées (ADR 0003), puis calculer la durée sur l'appareil.
- **B. Utiliser la durée renvoyée par l'IGN** et la corriger : impossible de savoir quelles routes
  sont plus lentes que 45 km/h.

## Décision
**Option A.**
- Sur chaque tronçon : la vitesse habituelle de la personne (45 km/h par défaut, réglable de 10 à
  45 km/h), ou la vitesse de la route si elle est plus basse. Sans vitesse connue : la vitesse habituelle.
- Le calcul se fait sur l'appareil : changer la vitesse ou l'heure de départ marche sans réseau.
- La vitesse habituelle est gardée sur l'appareil (`localStorage`, clé `vitesse-habituelle`, sans
  donnée personnelle). L'heure de départ ne vaut que pour le trajet en cours (maintenant par défaut).
- Rien de plus ne quitte l'appareil.

## Conséquences
- **Positives** : durée réaliste, recalcul immédiat et hors connexion.
- **Négatives** : `vitesse_moyenne_vl` est la vitesse habituelle des voitures, pas toujours la
  limite légale.
- **À vérifier sur de vrais trajets** : que le service renvoie bien `vitesse_moyenne_vl` dans
  les attributs de chaque étape.
