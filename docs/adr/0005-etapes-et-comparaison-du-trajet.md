# 0005 — Étapes du trajet et comparaison avec le plus court

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Story** : #5 « Voir et comparer le trajet avant de partir »

## Contexte
Avant de partir, la personne veut lire les villages traversés et les routes empruntées, et
comparer avec le trajet le plus court. Le service de l'IGN (ADR 0003) donne, pour chaque tronçon,
le numéro de la route et un code de commune (INSEE), mais pas le nom du village.

## Options
- **A. Nom du village par le service public des adresses** (Base Adresse Nationale, déjà utilisé,
  ADR 0002) : une demande par commune traversée, avec seulement son code.
- **B. Une table des communes embarquée dans l'appli** : plusieurs mégaoctets à télécharger.

## Décision
**Option A**, validée par le PO avec le plan de la story.
- Les demandes à l'IGN ajoutent `insee_commune_gauche` à `waysAttributes`.
- Les tronçons qui se suivent sur la même route et dans la même commune forment **une seule étape**.
- Le nom de chaque commune est demandé une fois (`/geocodage/search?q=<code>&type=municipality&citycode=<code>`).
  Seul le code de la commune part : aucune donnée personnelle. Un nom introuvable s'affiche
  « Commune non précisée », sans bloquer le calcul.
- Le trajet le plus court sans autoroute est gardé en mémoire avec le trajet retenu (store
  `itineraire`) ; sa durée est calculée sur l'appareil, à la vitesse de la personne (ADR 0004).

## Conséquences
- **Positives** : pas de nouveau service ; liste courte et lisible ; comparaison recalculée sans réseau.
- **Négatives** : quelques demandes de plus par calcul (une par commune traversée).
- **À vérifier sur de vrais trajets** : que l'IGN renvoie bien `insee_commune_gauche`, et que la
  recherche par code de commune renvoie le bon nom.
