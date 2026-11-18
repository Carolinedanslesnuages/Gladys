# Fiche de relecture — Story #4 « Connaître mon vrai temps de trajet »

**En tant que** conducteur de voiture sans permis, **je veux** voir une durée calculée selon la
vitesse réelle de ma VSP, **afin de** savoir à quelle heure je vais vraiment arriver.

Sur l'écran « Préparer mon trajet », après « Calculer mon itinéraire », une partie « Mon temps de
trajet » affiche côte à côte la durée estimée et l'heure d'arrivée, puis deux champs : vitesse
moyenne habituelle (km/h) et heure de départ (maintenant par défaut).

## Critères d'acceptation et tests qui les prouvent

| Critère | Tests |
|---|---|
| Durée calculée à 45 km/h au plus, et à la vitesse de la route si elle est plus basse | `services/__tests__/duree.spec.ts` › Critère 1 (route à 30 → 30 km/h, route à 80 → 45 km/h ; route sans vitesse connue → vitesse habituelle) ; `services/__tests__/itineraire.spec.ts` › Story #4 (vitesse de chaque route demandée à l'IGN et gardée par tronçon) ; `TrajetView.spec.ts` › Critères 1 et 2 (32 min à l'écran) |
| L'heure d'arrivée s'affiche à côté de la durée | `duree.spec.ts` › Critère 2 (départ 8 h 00 + 20 min → 8 h 20 ; arrivée « le lendemain ») ; `stores/__tests__/duree.spec.ts` › Critère 2 ; `TrajetView.spec.ts` › Critères 1 et 2 (« vers 8 h 32 », annoncé) et « part de maintenant par défaut » |
| Je peux régler ma vitesse habituelle (ex. 40 km/h) et la durée est recalculée | `duree.spec.ts` › Critère 3 ; `stores/…/duree.spec.ts` › Critère 1 et 3, vitesse gardée et relue, stockage plein signalé ; `TrajetView.spec.ts` › Critère 3 (35 min à 40 km/h, sans réseau, vitesse gardée) et vitesse hors de 10 à 45 km/h refusée avec message |

Choix du PO appliqués : la vitesse réglée remplace les 45 km/h, la route plus lente reste
prioritaire ; toute valeur de 10 à 45 km/h (virgule acceptée) ; heure de départ au choix,
maintenant par défaut. Décision tracée dans `docs/adr/0004-duree-du-trajet.md`.

## Accessibilité

Vérifié automatiquement :
- test axe-core de l'écran avec durée, champs vitesse et heure, et message d'erreur : 0 violation ;
- lint d'accessibilité : 0 erreur.

Mis en place :
- champs DSFR (`DsfrInputGroup`) avec étiquette visible, unité « km/h » dans l'étiquette, aide
  (bornes, mémoire sur le téléphone), clavier décimal sur téléphone, sélecteur d'heure natif ;
- erreur écrite en clair sous le champ et reliée à lui (« Indiquez une vitesse entre 10 et 45 km/h,
  par exemple 40. ») ; la durée affichée reste la dernière valide ;
- nouvelle durée annoncée (`role="status"`) : « Durée estimée : 32 min, arrivée vers 8 h 32. » ;
- durée en toutes lettres (« 1 h 25 min »), jamais par la couleur ; titre `h3` sous le `h2`
  « Mon itinéraire ».

**À vérifier par un humain :**
- lecteur d'écran (NVDA, VoiceOver) : annonce de la durée à chaque changement de vitesse ou d'heure,
  sans répétition gênante pendant la frappe ;
- sélecteur d'heure : utilisable au clavier et au lecteur d'écran sur iPhone et Android ;
- affichage à 320 px et zoom 200 % (durée et arrivée passent l'une sous l'autre) ; focus visible ;
- contraste (non mesurable automatiquement ici).

**À vérifier sur de vrais trajets (service de l'IGN, non joignable depuis les tests) :**
- que chaque étape renvoie bien `vitesse_moyenne_vl` ; sinon la durée est comptée partout à la
  vitesse habituelle (pas d'erreur, mais moins précise).

## Périmètre
- Ajouté : calcul de durée sur l'appareil et ses tests, espace commun « durée » (vitesse gardée,
  heure de départ) et ses tests, partie « Mon temps de trajet » de l'écran, ADR 0004.
- Modifié : service d'itinéraire (demande la vitesse des routes, garde les tronçons) ; tests de la
  story #3 adaptés à cette nouvelle forme ; écran « Préparer mon trajet » (nouvelle partie, tests).
- Aucune dépendance ajoutée. L'heure de départ n'est pas gardée d'une fois sur l'autre (choix :
  elle ne vaut que pour le trajet en cours).
- Remarqué, non corrigé : avertissement « VIcon déjà enregistré » dans les tests d'écran (sans effet).

## Résultat des contrôles (dans le conteneur)
| Contrôle | Résultat |
|---|---|
| `npx oxlint .` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur |
| `npm run type-check` | ✅ |
| `npm run test:unit -- --run` | ✅ 64 / 64 (10 fichiers) |
| `npm run build-only` | ✅ |
