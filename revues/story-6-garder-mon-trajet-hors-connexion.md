# Story #6 — Garder mon trajet hors connexion

**En tant que** conducteur de voiture sans permis, **je veux** enregistrer un trajet préparé sur mon téléphone, **afin d'**être guidé même sans réseau à la campagne.

Choix du PO : sans réseau, tracé + étapes + morceaux de carte déjà vus ; pas de limite de favoris ; accord à part au premier favori. Décision : `docs/adr/0013-trajets-favoris-hors-connexion.md`.

## Critères d'acceptation et tests qui les prouvent
| Critère | Test |
|---|---|
| Un trajet enregistré s'ouvre sans réseau | `src/views/__tests__/TrajetFavoris.spec.ts` : favori rouvert réseau coupé, aucun appel réseau, tracé, étapes, durée et message « zones jamais regardées restent vides » ; idem en ligne (pas de recalcul). `src/components/__tests__/CarteTrajet.spec.ts` : la carte reste affichée hors connexion pour un favori. `src/stores/__tests__/favoris.spec.ts` : l'itinéraire restauré n'appelle aucun service |
| Enregistrer et nommer mes trajets favoris | `TrajetFavoris.spec.ts` : enregistrement sous un nom, présent dans la liste puis après rechargement ; nom vide refusé avec erreur reliée au champ ; accord demandé une seule fois, refus = rien enregistré. `favoris.spec.ts` : nom vide / trop long refusés, aucune limite (30 favoris), accord distinct de l'historique, appareil plein sans perte |
| Supprimer un trajet enregistré | `TrajetFavoris.spec.ts` : suppression après confirmation (disparaît aussi du stockage), « Annuler » conserve le favori. `favoris.spec.ts` : suppression durable après rechargement |

## Accessibilité
- Composants DSFR (`DsfrButton`, `DsfrInputGroup`, `DsfrAlert`), couleurs inchangées ; un seul `h1`, titres sans saut (h2 « Mes trajets favoris », h3 « Garder ce trajet hors connexion »).
- Champ « Nom du trajet (obligatoire) » : étiquette visible, indication, erreur reliée au champ ; le focus y revient en cas d'erreur.
- Boutons explicites : « Ouvrir le trajet favori … », « Supprimer le trajet … », « Oui, supprimer le trajet … » ; l'intitulé visible est contenu dans le nom accessible.
- Messages annoncés (`role="status"`) : trajet enregistré, supprimé, ouvert, carte non disponible hors connexion. Le focus est déplacé à chaque étape.
- Tout se fait au clavier (boutons et formulaire). Tests axe-core (`violationsAccessibilite`) : liste, formulaire, erreur, confirmation, avec et sans réseau — aucune violation.

**À vérifier par un humain :**
- sur un vrai téléphone, installé : préparer un trajet en regardant la carte, l'enregistrer, couper le réseau (mode avion), rouvrir le favori : les morceaux vus s'affichent, le reste est vide (le cache de la carte n'existe qu'après construction : `npm run build-only && npx vite preview`) ;
- lecteur d'écran : lecture des annonces et du déplacement du focus ;
- relire les textes de la demande d'accord (données personnelles).

## Périmètre
- Ajouté : store `favoris`, ADR 0013, tests, fiche. Modifié : écran « Préparer mon trajet » (enregistrer, liste, ouvrir, supprimer), carte (reste affichée hors connexion pour un favori), store `itineraire` (`restaurer`), `vite.config.ts` (cache des morceaux de carte, 2 000 au plus). Aucune dépendance ajoutée.
- Non traité : guidage à la voix (demande #7).
- À noter : le stockage du téléphone (environ 5 Mo) peut se remplir avec beaucoup de favoris ; la personne est prévenue, rien n'est perdu. IndexedDB serait la suite (voir ADR).

## Résultat des contrôles (dans le conteneur)
| Contrôle | Résultat |
|---|---|
| `npx oxlint .` | ✅ 0 erreur |
| `npx eslint .` | ✅ 0 erreur |
| `npm run type-check` | ✅ |
| `npm run test:unit -- --run` | ✅ 20 fichiers, tous réussis |
| `npm run build-only` | ✅ |
