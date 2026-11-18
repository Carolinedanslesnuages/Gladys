# Story #11 — Changer le nom

**En tant que** PO, **je veux** que le nom du projet change partout, **afin de** bien l'identifier : c'est désormais GLADYS.

## Critères d'acceptation et tests qui les prouvent
| Critère | Test |
|---|---|
| Le nom de l'ancienne application a disparu | `src/__tests__/nom-application.spec.ts` : chaque écran (« Préparer mon trajet », « Relevés ») affiche GLADYS, le titre de page finit par « — GLADYS », l'ancien nom n'apparaît nulle part dans la page ; titre de départ et nom de l'application installée = GLADYS |
| Message de localisation refusée | `src/views/__tests__/TrajetView.spec.ts` : « autorisez la localisation pour GLADYS » |
| Rien n'est perdu (données de l'appareil) | `src/services/__tests__/stockage.spec.ts` : les réglages enregistrés sous l'ancien préfixe sont repris sous `gladys:`, l'ancienne copie est effacée ; la donnée déjà enregistrée sous le nouveau nom est prioritaire ; appareil plein : l'ancienne donnée est gardée |

Recherche dans tout le dépôt : l'ancien nom ne subsiste que dans le code de reprise des données
(`ANCIEN_PREFIXE` de `src/services/stockage.ts`), ses tests et le motif de vérification du test
ci-dessus — nécessaire pour retrouver les données déjà enregistrées. Invisible pour l'utilisateur.

## Accessibilité
- Titres de page explicites conservés : « Préparer mon trajet — GLADYS », « Relevés — GLADYS » (RGAA 8.5, 8.6).
- Structure des titres inchangée (un seul `h1` par écran).
- Tests axe-core (`violationsAccessibilite`) des deux écrans relancés : aucune violation.

**À vérifier par un humain :**
- sur un téléphone où l'application était déjà installée : accepter la mise à jour proposée, vérifier le nom sous l'icône (il peut falloir réinstaller) ;
- vérifier que trajets récents, vitesse habituelle et réglage du détour sont toujours là après la mise à jour ;
- lecteur d'écran : le nom « GLADYS » en capitales peut être épelé lettre par lettre ; à écouter.

## Périmètre
- Modifié : nom affiché (en-tête, titre de l'onglet, titre de l'écran « Relevés », message de localisation), nom de l'application installée, documents du projet (instructions, présentation, ADR 0001, fiche de la story #2).
- Modifié : préfixe des données enregistrées (`gladys:`) avec reprise automatique des anciennes données ; clés mises à jour dans les tests existants.
- Ajouté : deux fichiers de tests. Aucune dépendance ajoutée.
- Non modifié : le nom technique du paquet (`pwa`), qui ne contenait pas l'ancien nom.

## Résultat des contrôles (dans le conteneur)
| Contrôle | Résultat |
|---|---|
| `npx oxlint .` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur |
| `npm run type-check` | ✅ |
| `npm run test:unit -- --run` | ✅ 12 fichiers, 82 tests |
| `npm run build-only` | ✅ |
