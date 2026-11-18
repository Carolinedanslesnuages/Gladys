# Story #40 — Me ramener vers le village suivant si je quitte le trajet

Issue de la demande #7 (découpage) : #7 se termine quand toutes ses stories sont livrées.

## Critères d'acceptation et tests
| Critère | Tests qui le prouvent |
|---|---|
| Écart de plus de 100 m détecté et dit | `stores/__tests__/conduite-recalcul.spec.ts` (150 m : alerte après 3 positions ; 50 m : rien ; écart isolé : rien ; phrase dite à la voix) ; `views/__tests__/ConduiteRecalcul.spec.ts` (message « Vous avez quitté le trajet » à l'écran) |
| Nouveau chemin vers le village suivant, en évitant les départementales à fort trafic | `conduite-recalcul.spec.ts` (calcul depuis la position vers l'entrée du village suivant ; trajet remplacé, reste du trajet gardé, favori non touché). L'évitement vient du calcul d'itinéraire déjà livré, réutilisé tel quel. |
| Sans chemin sûr : le dit et propose le plus sûr | `conduite-recalcul.spec.ts` (proposé, pris seulement après accord) ; `ConduiteRecalcul.spec.ts` (message + vrai bouton « Suivre le chemin le plus sûr ») |
| Sans réseau : message clair | `conduite-recalcul.spec.ts` (appareil hors ligne et coupure pendant le calcul : trajet d'origine gardé, navigation non bloquée) ; `ConduiteRecalcul.spec.ts` (message affiché) |

## Choix et comportement
- Écart fixé à 100 m (constante existante) ; alerte après **3 positions de suite** hors trajet, contre les fausses alertes du GPS.
- Chemin sans départementale à fort trafic : pris automatiquement. Sinon : proposé, la personne l'accepte avec un bouton.
- Le nouveau chemin remplace le début du trajet suivi ; la suite après le village est conservée. Le trajet favori enregistré n'est pas modifié.
- De retour sur le trajet, les messages d'attente disparaissent. Bouton « Réessayer le recalcul » sans réseau.

## Accessibilité
- Test axe-core à chaque état (calcul, nouveau chemin, chemin le plus sûr, sans réseau).
- Messages dans une zone `role="status"` (7.5) ; texte + icône, jamais la couleur seule (3.1) ; vrais boutons du composant `Bouton` (7.3, 10.7).
- **À vérifier par un humain** : lecteur d'écran (annonce des messages, pas de répétition gênante avec la voix) ; essai sur le terrain ou avec une position simulée ; lisibilité à 320 px ; navigation au clavier.

## Périmètre
- Ajoutés : `services/recalcul.ts`, recalcul dans `stores/conduite.ts`, deux petites actions dans `stores/itineraire.ts`, messages et boutons dans l'écran de conduite, tests.
- Aucune dépendance, aucun nouveau composant d'interface.
- Limite notée : le nouveau chemin vise l'entrée du village suivant sur le tracé d'origine ; seule la voix prononce l'alerte (pas de vibration).

## Contrôles
Voir le message de livraison : lint, types, tests et compilation.
