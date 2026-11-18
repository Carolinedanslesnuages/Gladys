# Fiche de relecture — Story #5 « Voir et comparer le trajet avant de partir »

**En tant que** conducteur de voiture sans permis, **je veux** voir la liste des villages
traversés et des routes empruntées, **afin de** vérifier que le trajet me convient avant de
prendre le volant. (Issue de la demande #1.)

Sur l'écran « Préparer mon trajet », après « Calculer mon itinéraire », deux parties s'ajoutent
sous « Mon temps de trajet » :
- **Comparer avec le trajet le plus court** : distance et durée du plus court, puis l'écart
  (« 4 min de plus, 2,5 km de plus »), ou « Votre trajet est déjà le trajet le plus court sans autoroute. » ;
- **Les étapes de mon trajet** : liste numérotée « Vienne — D502 — 4 km », avec la mention
  écrite « Départementale » sur les étapes concernées.

## Critères d'acceptation et tests qui les prouvent

| Critère | Tests |
|---|---|
| La liste des étapes est écrite en texte, dans l'ordre (village, route, distance) | `services/__tests__/itineraire.spec.ts` › Story #5 › Critère 1 (ordre, tronçons qui se suivent réunis, rue ou « Route sans nom » sans numéro ; nom du village demandé par code de commune, nom introuvable ou service muet → pas d'erreur) ; `TrajetView.spec.ts` › Story #5 › Critère 1 (liste `ol` : « Vienne — Rue de la Gare — 0,5 km », « Vienne — C3 — 3 km », « Les Abrets — C5 — 9 km ») |
| Les passages sur départementale sont signalés par un texte, pas seulement par une couleur | `itineraire.spec.ts` › Story #5 › Critère 2 (D12 et RD 4 oui, N7 non) ; `TrajetView.spec.ts` › Critère 2 (« Vienne — D502 — 4 km Départementale », rien sur la C3) |
| Je peux comparer avec le trajet le plus court et voir la différence de temps | `services/__tests__/duree.spec.ts` › Story #5 (écart « de plus », « de moins », « même durée ») ; `stores/__tests__/duree.spec.ts` › Story #5 (durée du plus court à 45 puis 40 km/h) ; `stores/__tests__/itineraire.spec.ts` › Story #5 (les deux trajets gardés) ; `TrajetView.spec.ts` › Critère 3 (« 10 km, 13 min » ; « 4 min de plus, 2,5 km de plus » annoncé ; 5 min de plus à 30 km/h) et « déjà le plus court » |

Choix du plan validé : les deux trajets (retenu et plus court) sont gardés dans le store
`itineraire` pour les stories suivantes ; tronçons consécutifs même route + même village = une
étape ; nom du village par le service public des adresses (code de commune seul). Décision
tracée dans `docs/adr/0005-etapes-et-comparaison-du-trajet.md`.

## Accessibilité

Vérifié automatiquement :
- test axe-core de l'écran avec comparaison et étapes, avec et sans départementale : 0 violation ;
- lint d'accessibilité : 0 erreur.

Mis en place :
- étapes en vraie liste numérotée (`ol`), reliée à son titre ; texte lisible hors couleur ;
- « Départementale » écrite dans un badge DSFR (`DsfrBadge`, couleurs DSFR inchangées) : la
  couleur n'est jamais seule ;
- comparaison annoncée (`role="status"`), recalculée quand la vitesse change ;
- titres `h3` sous le `h2` « Mon itinéraire », sans saut ; longs noms de rue coupés pour
  rester lisibles à 320 px.

**À vérifier par un humain :**
- lecteur d'écran (NVDA, VoiceOver) : lecture de la liste (numéros, tirets, mention
  « Départementale ») et annonce de la comparaison, sans répétition gênante pendant la frappe
  de la vitesse ;
- affichage à 320 px et zoom 200 % (longues listes, noms de rue longs) ; focus visible ;
- contraste du badge « Départementale » (couleurs DSFR, non mesurable automatiquement ici).

**À vérifier sur de vrais trajets (services non joignables depuis les tests) :**
- que l'IGN renvoie bien `insee_commune_gauche` dans chaque étape (sinon : « Commune non précisée ») ;
- que la recherche par code de commune renvoie bien le nom du village ;
- la longueur de la liste sur un long trajet.

## Périmètre
- Ajouté : étapes du trajet et nom des villages (service d'itinéraire, service d'adresses), écart
  de durée, durée du plus court dans l'espace commun « durée », parties « Comparer… » et
  « Les étapes… » de l'écran, ADR 0005, tests.
- Modifié : le résultat d'itinéraire garde aussi le plus court ; tests des stories #3 et #4
  adaptés à cette nouvelle forme (attribut demandé en plus à l'IGN, étapes vides).
- Aucune dépendance ajoutée. Sans réseau, rien ne change : le calcul reste impossible, la
  comparaison se recalcule sur l'appareil.
- Remarqué, non corrigé : avertissement « VIcon déjà enregistré » dans les tests d'écran (sans effet).

## Résultat des contrôles (dans le conteneur)
| Contrôle | Résultat |
|---|---|
| `npx oxlint .` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur |
| `npm run type-check` | ✅ (après remplacement d'un `.at(-1)` non accepté par la cible) |
| `npm run test:unit -- --run` | ✅ 75 / 75 (10 fichiers) |
| `npm run build-only` | ✅ |
