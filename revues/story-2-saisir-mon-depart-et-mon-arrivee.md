# Fiche de relecture — Story #2 « Saisir mon départ et mon arrivée »

**En tant que** conducteur de voiture sans permis, **je veux** indiquer un point de départ et une
destination par adresse ou nom de commune, **afin de** préparer mon trajet avant de partir.

Nouvel écran « Préparer mon trajet », devenu la page d'accueil (l'exemple « Relevés » reste
accessible par le lien en haut de page).

## Critères d'acceptation et tests qui les prouvent

| Critère | Tests |
|---|---|
| Saisir une adresse ou une commune pour le départ et l'arrivée | `TrajetView.spec.ts` › Critère 1 : propositions pendant la saisie (commune puis adresse), choix retenu dans chaque champ, focus rendu au champ ; validation refusée tant qu'aucun lieu n'est choisi |
| Utiliser ma position actuelle comme départ | `TrajetView.spec.ts` › Critère 2 : position accordée → départ rempli avec l'adresse la plus proche ; position refusée → message clair, aucune requête |
| Message clair si adresse introuvable ou réseau absent | `TrajetView.spec.ts` › Critère 3 : « Adresse introuvable… » ; « La recherche d'adresse a besoin du réseau… » quand le service ne répond pas ; hors connexion, recherche et position désactivées avec explication |
| Mes 5 derniers trajets restent proposés, même hors connexion | `TrajetView.spec.ts` › Critère 4 (accord demandé avant de garder, refus = rien gardé, reprise d'un trajet sans réseau, effacement avec confirmation) ; `trajets.spec.ts` (5 au maximum, du plus récent au plus ancien, sans doublon, relus au démarrage, rien sans accord, refus = effacement, stockage plein signalé) |

Choix du PO appliqués : Base Adresse Nationale ; historique gardé seulement avec accord, bouton
pour l'effacer ; sans réseau, seuls les trajets récents sont utilisables. Décision tracée dans
`docs/adr/0002-recherche-d-adresses-et-trajets-recents.md`.

## Accessibilité

Vérifié automatiquement :
- test axe-core de l'écran avec propositions affichées, question d'accord et trajets récents : 0 violation ;
- lint d'accessibilité : 0 erreur.

Mis en place :
- composants DSFR (champs, boutons, alertes) ; un seul `h1`, puis des `h2` ; titre de page « Préparer mon trajet — LÉON » ;
- étiquettes visibles « Départ » / « Arrivée », champs obligatoires signalés (astérisque expliqué), aide sous chaque champ ;
- erreurs écrites en clair, reliées au champ (`aria-describedby`) et annoncées ;
- propositions = liste de boutons atteignables au clavier ; leur nombre est annoncé (`role="status"`) ; après un choix, le focus revient au champ ;
- question d'accord et confirmation d'effacement : le focus y est amené ; après réponse, il va au titre « Mes trajets récents » ;
- boutons explicites (« Utiliser ma position actuelle », « Reprendre le trajet de Lyon à Vienne », « Effacer mes trajets récents ») ; cibles tactiles de 48 px.

**À vérifier par un humain :**
- avec un lecteur d'écran (NVDA, VoiceOver) : annonce du nombre de propositions, des erreurs et du « Lieu retenu » ;
- parcours complet au clavier, ordre logique et focus visible ;
- affichage à 320 px de large et zoom 200 % (libellés d'adresse longs dans les boutons) ;
- sur un vrai téléphone : demande d'autorisation de position, refus, puis mode avion ;
- contraste (non mesurable automatiquement ici).

## Périmètre
- Ajouté : écran « Préparer mon trajet », champ de recherche de lieu, recherche d'adresses, position actuelle, espace commun des trajets récents (store Pinia) et ses tests, ADR 0002.
- Modifié : la page d'accueil devient « Préparer mon trajet » ; « Relevés » passe à `/releves` ; liens d'accès rapide dans l'en-tête ; titre de page selon l'écran.
- Aucune dépendance ajoutée. Le calcul d'itinéraire n'est pas dans cette demande : « Valider mon trajet » prépare et garde le trajet.

**Problème repéré, non corrigé (hors périmètre) :** le test existant « relit les relevés au
démarrage » échoue déjà : il utilise la clé `__SLUG__:releves` au lieu de `leon:releves` (gabarit
de création du projet non remplacé). Correction d'une ligne à faire dans une demande `fix/` séparée.

## Résultat des contrôles (dans le conteneur)
| Contrôle | Résultat |
|---|---|
| `npx oxlint .` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur |
| `npm run type-check` | ✅ |
| `npm run test:unit -- --run` | ⚠️ 26 / 27 : les 18 nouveaux tests passent ; 1 échec préexistant (relevés, voir ci-dessus) |
| `npm run build-only` | ✅ (lancé séparément, la chaîne s'étant arrêtée aux tests) |
