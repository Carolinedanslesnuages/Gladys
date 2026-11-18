# Story #38 — Annoncer chaque consigne à la voix

Issue de la demande #7 (découpage) : #7 se termine quand toutes ses stories sont livrées.

## Choix du PO
- Consigne dite à 200 m du virage (hypothèse gardée, réglable : `DISTANCE_D_ANNONCE_METRES` dans `services/voix.ts`).
- Voix de l'appareil uniquement (synthèse vocale du navigateur), voix française locale.
- Couper la voix : #39. Retour au trajet : #40.

## Critères d'acceptation et tests
| Critère | Tests qui le prouvent |
|---|---|
| Consigne dite en français avant l'intersection (« Dans 1xx m, tournez à droite vers Saint-Martin ») | `stores/__tests__/conduite.spec.ts` (dit à moins de 200 m, rien avant) ; `services/__tests__/voix.spec.ts` (langue fr-FR, voix française) |
| Une même consigne n'est pas répétée en boucle | `conduite.spec.ts` (trois positions proches : une seule fois, puis l'arrivée est dite à son tour) |
| Sans voix : l'appli le dit, la consigne reste affichée | `voix.spec.ts` (aucune voix, voix non française, pas de synthèse) ; `conduite.spec.ts` ; `views/__tests__/ConduiteView.spec.ts` (message + consigne visible) |
| Voix hors connexion | `voix.spec.ts` (voix locale seulement, voix en ligne refusée, aucun appel réseau) |

## Accessibilité
- Test axe-core sur l'écran de conduite avec le message « pas de voix » (`ConduiteView.spec.ts`).
- Message dans une zone `role="status"` : annoncé sans rechargement (7.5). Texte et icône, pas la couleur seule (3.1). Composant `Alerte` existant, contrastes déjà testés (3.2).
- La consigne dite reste écrite à l'écran (équivalent écrit). Aucun nouveau bouton.
- **À vérifier par un humain** : sur un vrai téléphone, présence et qualité de la voix française ; absence de double lecture avec un lecteur d'écran (la zone d'annonce existante dit déjà la consigne) ; volume en conduite réelle.

## Périmètre
- Ajoutés : `services/voix.ts`, `phraseAnnoncee` et `rangEtape` dans `services/consignes.ts`, mémoire de la dernière consigne dite et indicateur « voix absente » dans le store de conduite, message dans l'écran de conduite.
- Rien n'est enregistré ni envoyé : seule la dernière consigne dite est gardée en mémoire, effacée à l'arrêt du trajet.
- Limites notées : si la liste des voix n'est pas encore chargée par le navigateur, on laisse l'appareil choisir en fr-FR (pas de détection possible). Une voix française « en ligne » est refusée pour rester hors connexion.

## Contrôles
Voir le résultat dans le message de livraison : lint, types, tests et compilation.
