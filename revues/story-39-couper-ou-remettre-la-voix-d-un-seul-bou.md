# Story #39 — Couper ou remettre la voix d'un seul bouton

Issue de la demande #7 (découpage) : #7 se termine quand toutes ses stories sont livrées.

## Critères d'acceptation et tests
| Critère | Tests qui le prouvent |
|---|---|
| Un bouton de 44 px minimum coupe la voix ; le même bouton la remet | `views/__tests__/ConduiteView.spec.ts` (un seul bouton : « Couper la voix » puis « Remettre la voix ») ; `stores/__tests__/voix.spec.ts` (basculer, arrêt de la consigne en cours) ; 44 px garantis par le composant `Bouton` (`__tests__/apparence.spec.ts`) |
| L'état est écrit en texte | `ConduiteView.spec.ts` (texte « Voix active » / « Voix coupée », zone `role="status"`) |
| Choix gardé sur l'appareil | `stores/__tests__/voix.spec.ts` (relecture après réouverture, appareil plein : voix changée pour ce trajet + message) ; `ConduiteView.spec.ts` (écran rouvert : « Voix coupée ») |
| Voix coupée, la consigne reste affichée en grand | `ConduiteView.spec.ts` (consigne visible en classe `consigne`, aucune phrase prononcée, aucune violation axe-core) |

## Choix et comportement
- Voix active par défaut. Remise avant le virage : la consigne proche est dite.
- Couper arrête aussitôt la consigne en cours de lecture.
- Store Pinia dédié `stores/voix.ts` (choix partagé entre l'écran et l'annonce) ; clé enregistrée : `gladys:voix-active`.

## Accessibilité
- Test axe-core sur l'écran voix coupée (`ConduiteView.spec.ts`).
- Vrai `<button>` (composant `Bouton`), clavier et focus visible hérités ; intitulé explicite (6.1, 11.9, 7.3, 10.7).
- État écrit en texte dans une zone `role="status"` : annoncé sans rechargement (7.5), jamais par la couleur ou l'icône seule (3.1).
- **À vérifier par un humain** : lecteur d'écran (annonce du changement d'état, bouton atteint dans un ordre logique) ; lisibilité et prise en main du bouton sur un vrai téléphone à 320 px ; navigation au clavier.

## Périmètre
- Ajoutés : `stores/voix.ts` (+ tests), `taireLaVoix` dans `services/voix.ts`, bouton et état dans l'écran de conduite, prise en compte du choix dans le store de conduite.
- Aucune dépendance ajoutée, aucun nouveau composant d'interface.
- Limite notée : le bouton n'apparaît que quand un trajet est suivi (pas pendant la recherche d'erreur de position ni sans trajet).

## Contrôles
Voir le message de livraison : lint, types, tests et compilation.
