# 0013 — Trajets favoris, ouverts sans réseau

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Story** : #6 « Garder mon trajet hors connexion »

## Contexte
La personne veut retrouver un trajet préparé (ex. : « Maison → Marché ») sans réseau, à la campagne.
Un favori peut révéler l'adresse de son domicile : c'est une donnée personnelle (voir ADR 0002).
Le fond de carte vient du serveur OpenStreetMap, dont l'usage interdit de télécharger de grandes zones à l'avance.

## Décision (choix du PO)
- **Contenu d'un favori** : nom, départ, arrivée, calculateur utilisé et itinéraire complet (tracé, étapes,
  tronçons pour recalculer la durée sur l'appareil). Tout est gardé sur l'appareil (`localStorage`,
  clés `favoris` et `accord-favoris`) ; rien n'est envoyé.
- **Sans réseau** : le favori affiche son tracé, ses étapes et les **morceaux de carte déjà vus**. Les zones jamais
  regardées restent vides, un message le dit.
- **Morceaux de carte** : le service worker garde en mémoire les morceaux vus (`CacheFirst`, 2 000 au plus,
  purge automatique si le téléphone manque de place). Aucun téléchargement à l'avance.
- **Nombre de favoris** : pas de limite. Si le téléphone est plein, l'enregistrement est refusé avec un message
  et **aucun favori existant n'est perdu**.
- **Accord** : un accord **à part** de celui de l'historique, demandé au premier favori. Sans accord, rien
  n'est enregistré. Suppression d'un favori à tout moment, avec confirmation.

## Conséquences
- **Positives** : trajet retrouvé sans réseau ; données sous le contrôle de la personne.
- **Négatives** : sans limite, `localStorage` (environ 5 Mo) finit par se remplir, sans perte de données.
  Les zones de carte jamais regardées restent vides hors connexion.
- **À surveiller** : si les favoris deviennent nombreux, passer à IndexedDB ; mention dans les informations
  sur les données personnelles.
