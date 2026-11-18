# Story #37 — Suivre ma position et afficher la consigne en grand

Issue de la demande #7 (découpage) : #7 se termine quand toutes ses stories sont livrées.

## Choix du PO
- Consigne avec le sens du virage (« Tournez à droite vers Saint-Martin »), calculé sur l'appareil.
- Passage à la consigne suivante à moins de 100 m de la fin de l'étape en cours.
- Position indisponible ou refusée : message clair et bouton « Réessayer ».

## Critères d'acceptation et tests
| Critère | Tests qui le prouvent |
|---|---|
| Au départ, le suivi démarre et la première consigne s'affiche | `stores/__tests__/conduite.spec.ts` (suit la position, première consigne) ; `views/__tests__/TrajetDemarrer.spec.ts` (bouton « Démarrer le trajet ») ; `views/__tests__/ConduiteView.spec.ts` |
| Consigne en gros caractères, lisible à 320 px | `ConduiteView.spec.ts` (classe « consigne », un seul h1). Taille 2 à 3,5 rem, retour à la ligne permis : **à vérifier à la main sur téléphone** |
| Consigne et distance mises à jour sans recharger | `consignes.spec.ts` (distance qui baisse, bascule à moins de 100 m) ; `conduite.spec.ts` ; `ConduiteView.spec.ts` |
| Position indisponible : message clair | `ConduiteView.spec.ts` (refusée, indisponible, bouton « Réessayer » relance le suivi) ; `conduite.spec.ts` |
| Sens du virage (droite, gauche, tout droit, demi-tour) | `consignes.spec.ts` |
| Trajet ancien sans consignes : demande de recalculer | `consignes.spec.ts`, `conduite.spec.ts`, `ConduiteView.spec.ts`, `TrajetDemarrer.spec.ts` |

## Accessibilité
- Test axe-core sur le nouvel écran (attente, consigne, position refusée) et sur l'accueil avec le nouveau bouton.
- Un seul h1, titre de page « Consigne de conduite — GLADYS », boutons de 44 px (composant `Bouton`).
- Consigne et distance annoncées par une zone de statut, seulement quand la consigne ou le palier de distance change. Message d'erreur en `role="alert"`.
- Sens du virage écrit en toutes lettres ; aucune information par la couleur seule.
- **À vérifier par un humain** : contraste réel (vert foncé sur blanc), lecture au lecteur d'écran (annonces pas trop bavardes), lisibilité à 320 px, comportement en conduite réelle.

## Périmètre
- Ajoutés : service des consignes, store de conduite, écran de conduite, bouton « Démarrer le trajet », ADR 0015.
- Modifié : les étapes gardent leur fin sur le tracé et leur virage (via le calcul d'itinéraire, donc aussi pour les favoris enregistrés à partir de maintenant).
- Hors périmètre, noté : voix (#38, #39), retour vers le village suivant (#40).
- Point à valider : à moins de 100 m du virage, l'écran passe déjà à la consigne d'après (règle choisie par le PO).
- Limite : un rond-point est lu comme un simple changement de direction.

## Contrôles
Lint (oxlint, eslint), types, 270 tests et compilation : tous au vert.
