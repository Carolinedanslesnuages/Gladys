# Fiche de relecture — Story #3 « Calculer un itinéraire adapté à ma VSP »

**En tant que** conducteur de voiture sans permis, **je veux** obtenir un itinéraire qui exclut les
autoroutes et voies rapides et qui évite autant que possible les routes départementales, **afin
de** rouler en sécurité sans ajouter d'étapes à la main.

Sur l'écran « Préparer mon trajet », une fois le départ et l'arrivée choisis, une partie « Mon
itinéraire » apparaît : choix du détour accepté, bouton « Calculer mon itinéraire », résultat.

## Critères d'acceptation et tests qui les prouvent

| Critère | Tests |
|---|---|
| L'itinéraire ne passe jamais par une autoroute ni une voie rapide | `services/__tests__/itineraire.spec.ts` › Critère 1 : les deux demandes envoyées à l'IGN interdisent les autoroutes (`banned wayType = autoroute`) ; `TrajetView.spec.ts` › « propose le calcul… sans autoroute ni voie rapide » |
| On évite les départementales si le détour reste sous le seuil (choisi par la personne, 30 % par défaut) | `services/…/itineraire.spec.ts` › Critère 2 : trajet direct 10 km, trajet de 12,5 km sans départementale retenu à 30 %, refusé à 20 % ; `TrajetView.spec.ts` › Critère 2 (30 % coché par défaut, même cas à l'écran, puis 20 %) et seuil retrouvé au retour ; `stores/__tests__/itineraire.spec.ts` (seuil par défaut, gardé et relu, stockage plein signalé, calcul avec le seuil choisi) |
| Le trajet affiche le nombre de kilomètres sur départementale, s'il en reste | `services/…/itineraire.spec.ts` › comptage par numéro « D… » / « RD… » ; `TrajetView.spec.ts` › Critère 3 : « Sur départementale 3,2 km » affiché et annoncé |
| Si aucun itinéraire sans départementale n'existe, l'appli le dit clairement | `services/…/itineraire.spec.ts` › Critère 4 : le trajet le plus sûr (le moins de départementale) est proposé ; `TrajetView.spec.ts` › Critère 4 : message « Aucun itinéraire sans départementale n'existe… » puis le trajet |
| Hors connexion (règle du projet) | `TrajetView.spec.ts` › bouton désactivé, message, aucun calcul lancé ; service qui ne répond pas → message clair (écran et store) |

Choix du PO appliqués : service de l'IGN ; seuil choisi par la personne (10, 20, 30 ou 50 %,
30 % par défaut, gardé sur le téléphone) ; sans trajet sans départementale, message puis trajet
le plus sûr. Décision tracée dans `docs/adr/0003-calcul-d-itineraire.md`.

## Accessibilité

Vérifié automatiquement :
- test axe-core de l'écran avec choix du détour, message d'alerte et résultat : 0 violation ;
- lint d'accessibilité : voir contrôles.

Mis en place :
- composants DSFR (boutons radio avec légende visible et aide, bouton, alertes) ; titre `h2`
  « Mon itinéraire » sous le `h1` existant ;
- résultat et messages dans une zone annoncée (`role="status"`), avec une phrase complète pour les
  lecteurs d'écran (« Itinéraire calculé : 11 km, sans autoroute ni voie rapide, dont 3,2 km sur
  départementale. ») ;
- départementales signalées par du texte, jamais par la couleur seule ;
- hors connexion, le bouton désactivé est accompagné d'un texte qui explique pourquoi.

**À vérifier par un humain :**
- avec un lecteur d'écran (NVDA, VoiceOver) : annonce du calcul en cours, du résultat et des messages ;
- parcours clavier : choix du détour aux flèches, bouton, ordre logique et focus visible ;
- affichage à 320 px de large et zoom 200 % ;
- contraste (non mesurable automatiquement ici).

**À vérifier sur de vrais trajets (service de l'IGN, non joignable depuis les tests) :**
- que l'interdiction « autoroute » écarte aussi les voies rapides ;
- que l'évitement des départementales est bien accepté par le service ;
- que les étapes renvoyées portent le numéro « D… » des départementales.

## Périmètre
- Ajouté : service de calcul d'itinéraire, espace commun « itinéraire » (seuil et trajet calculé)
  et leurs tests, partie « Mon itinéraire » de l'écran, ADR 0003.
- Modifié : écran « Préparer mon trajet » (nouvelle partie, tests ajoutés).
- Aucune dépendance ajoutée. Hors périmètre : carte (#5), temps de trajet (#4), guidage (#7) ;
  l'itinéraire calculé n'est pas gardé hors connexion.

## Résultat des contrôles (dans le conteneur)
| Contrôle | Résultat |
|---|---|
| `npx oxlint .` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur |
| `npm run type-check` | ✅ |
| `npm run test:unit -- --run` | ✅ 46 / 46 (8 fichiers) |
| `npm run build-only` | ✅ |

Remarque : au premier passage de la chaîne complète, le conteneur, surchargé, n'a pas pu démarrer
deux fichiers de tests dans le délai (« Timeout starting forks runner »), sans échec de test.
Tests et construction relancés seuls : tous au vert (résultats ci-dessus).
