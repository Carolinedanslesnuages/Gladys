# 0012 — Carte dans le sens de la marche, véhicule plus bas, calcul immédiat

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Demande** : #26 (conversation) — lancer le calcul dès le choix de la destination, durée et
  distance sur la carte, véhicule plus bas, carte qui tourne dans le sens de la marche

## Contexte
Leaflet ne sait pas faire tourner une carte. Sans rotation, le véhicule tourne et la route devant
peut se trouver sur le côté ou en bas de l'écran.

## Décision
- Ajout du module **`leaflet-rotate` 0.2.8** (licence GPL-3.0), version épinglée exactement. Les
  versions 0.3 et plus, publiées en rafale fin 2026, ne sont pas retenues sans relecture.
- Pendant le suivi, la carte tourne pour mettre **la direction de marche en haut**. Le bouton
  boussole « Garder le nord en haut de la carte » arrête la rotation ; il la relance aussi. Aucun
  geste caché ne fait tourner la carte (rotation tactile et touche Maj désactivées).
- Le trajet en entier et l'arrêt du suivi remettent le nord en haut.
- Le véhicule est placé **20 % de la hauteur sous le centre** : on voit plus de route devant. Le
  décalage suit la rotation de la carte.
- Le **calcul part dès le choix de la destination** (ou du départ, s'il n'est pas « Ma position »),
  et à la reprise d'un trajet récent. « Valider mon trajet » reste en secours tant qu'il n'y a pas
  de résultat.
- La **durée, la distance et l'heure d'arrivée** s'affichent dans un panneau posé sur la carte,
  avec « Voir le détail du trajet ». Le focus n'est plus déplacé sous la carte après le calcul.

## Conséquences
- Licence GPL-3.0 du module : à confirmer avec l'équipe avant une diffusion publique.
- jsdom ne fait pas tourner les éléments : les tests vérifient l'angle demandé et le centre calculé.
- À vérifier sur un vrai téléphone, en roulant : sens de rotation et confort de lecture.
