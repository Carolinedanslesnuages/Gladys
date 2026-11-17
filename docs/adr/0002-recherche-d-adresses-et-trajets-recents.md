# 0002 — Recherche d'adresses et trajets récents

- **Statut** : Accepted
- **Date** : 2026-11-17
- **Story** : #2 « Saisir mon départ et mon arrivée »

## Contexte
Pour préparer un trajet, la personne saisit un départ et une arrivée (adresse ou commune), ou
utilise sa position actuelle. Ses 5 derniers trajets doivent rester proposés, même sans réseau.
Adresses tapées, position et historique disent où vit et où va la personne : ce sont des données
personnelles.

## Options
- **A. Base Adresse Nationale** (service public, gratuit, sans compte), servie par la Géoplateforme
  de l'IGN (`https://data.geopf.fr/geocodage`, recherche et adresse la plus proche d'une position).
- **B. Un autre service** (commercial) : compte, clé secrète, conditions d'usage des données.
- **C. Liste des communes embarquée** : hors connexion, mais pas d'adresse précise.

## Décision
**Option A**, choisie par le PO.
- Le texte tapé (3 caractères au moins) et, à la demande, la position sont envoyés à la Base Adresse
  Nationale. Rien d'autre ne quitte l'appareil.
- La position n'est demandée que sur le bouton « Utiliser ma position actuelle » ; elle est
  transformée en adresse proche et n'est jamais enregistrée telle quelle.
- Les 5 derniers trajets ne sont gardés sur l'appareil (`localStorage`, clés `trajets-recents` et
  `accord-historique`) qu'**après l'accord explicite** de la personne, demandé au premier trajet.
  Un refus efface tout ; un bouton efface l'historique à tout moment (avec confirmation).
- Sans réseau : la recherche et la position sont désactivées (message explicatif) ; seuls les
  trajets récents peuvent être repris.

## Conséquences
- **Positives** : service public sans compte ni secret ; historique sous le contrôle de la personne.
- **Négatives** : pas de recherche hors connexion ; dépendance à la disponibilité du service.
- **À surveiller** : changement d'adresse du service (l'ancienne `api-adresse.data.gouv.fr` a été
  remplacée par la Géoplateforme) ; mention dans les informations sur les données personnelles.
