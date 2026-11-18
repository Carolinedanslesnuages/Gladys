# 15. Consignes de conduite calculées sur l'appareil

Date : 2026-11-18 — Statut : accepté (story #37)

## Contexte
Les étapes du trajet donnent la route, le village et la distance, pas le sens du virage. L'écran de
conduite doit dire « Tournez à droite vers Saint-Martin » en grand, sans réseau.

## Décision
- Le sens du virage (droite, gauche, tout droit, demi-tour) est calculé sur l'appareil à partir du
  tracé, à la fin de chaque étape (`src/services/consignes.ts`). Les deux calculateurs (IGN,
  OpenStreetMap) passent par le même point : aucun appel réseau en plus.
- Chaque étape garde `rangFinDansLeTrace` et `virageALaFin` : ils sont enregistrés avec le trajet,
  donc les favoris fonctionnent hors connexion.
- Passage à la consigne suivante : à moins de 100 m de la fin de l'étape en cours (choix du PO).
- La position suivie reste en mémoire (store `conduite`) : ni enregistrée, ni envoyée.
- Un trajet enregistré avant cette version n'a pas ces champs : l'écran demande de le recalculer.

## Conséquences
- Le sens du virage vient de la géométrie du tracé : un carrefour complexe (rond-point) est lu
  comme un simple changement de direction.
