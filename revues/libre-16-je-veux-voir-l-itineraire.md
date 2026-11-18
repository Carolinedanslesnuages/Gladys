# Demande #16 — Voir l'itinéraire sur une carte

**Réalisé hors story, en mode libre.**

Choix du PO : seul le trajet retenu pour la VSP ; carte déplaçable et zoomable (doigts, boutons
+ et −, clavier) ; sans réseau, message « Carte indisponible sans connexion », étapes lisibles.
Décision tracée : `docs/adr/0006-carte-du-trajet.md`.

## Critères et tests qui les prouvent

| Critère (plan validé) | Tests |
|---|---|
| La carte reçoit le tracé du trajet retenu, et lui seul | `CarteTrajet.spec.ts` « montre le tracé du trajet retenu, et lui seul » ; `itineraire.spec.ts` « demande le tracé en GeoJSON et garde celui du trajet retenu » ; `TrajetView.spec.ts` « affiche la carte du trajet retenu au-dessus de la liste des étapes » |
| Repères Départ et Arrivée aux bons endroits | `CarteTrajet.spec.ts` « place un repère écrit « Départ » au début du tracé et « Arrivée » à la fin » |
| Cadrage sur tout le trajet à l'ouverture | `CarteTrajet.spec.ts` « s'ouvre cadrée sur tout le trajet » |
| Zoom par les boutons + et − | `CarteTrajet.spec.ts` « les boutons « Zoomer » et « Dézoomer » changent le niveau de zoom » |
| Déplacement et zoom aux doigts et au clavier | `CarteTrajet.spec.ts` « se déplace et zoome au clavier, sans piège » (focus, clavier, glisser, pincer activés) |
| Sans réseau : message, étapes visibles | `CarteTrajet.spec.ts` « sans réseau, annonce… » et « affiche la carte au retour du réseau » ; `TrajetView.spec.ts` « sans réseau, dit « Carte indisponible sans connexion » et garde les étapes lisibles » |
| Tracé absent : pas de carte, sans erreur | `itineraire.spec.ts` « un trajet sans tracé reçu garde un tracé vide, sans erreur » |
| Accessibilité automatique de l'écran | `CarteTrajet.spec.ts` et `TrajetView.spec.ts` « aucune violation d'accessibilité automatique » (avec et sans réseau) |

## Accessibilité

Fait :
- carte nommée « Carte du trajet de … à … » (`role="region"`), aide écrite reliée (`aria-describedby`) ;
- **la liste des étapes reste l'alternative écrite** à la carte, toujours affichée ;
- repères « Départ » et « Arrivée » écrits (pas d'information par la couleur seule) ;
- boutons DSFR « Zoomer sur la carte » / « Dézoomer la carte », grande taille (48 px) ;
- carte atteignable à la tabulation, flèches pour déplacer, + et − pour zoomer, focus visible ;
- molette désactivée : le défilement de la page n'est pas capturé ;
- message sans réseau dans une zone `role="status"` ;
- animations coupées si `prefers-reduced-motion` ;
- titre `h3` « Mon trajet sur la carte », sans saut de niveau.

**À vérifier par un humain** :
- sur un vrai téléphone : déplacer la carte au doigt sans gêner le défilement de la page ;
- lecteur d'écran (VoiceOver, TalkBack, NVDA) : annonce du nom de la carte et du message sans réseau ;
- focus visible sur la carte, au clavier, dans le navigateur réel ;
- contraste des repères et du tracé sur le fond Plan IGN ;
- lisibilité à 320 px et zoom texte à 200 % ;
- sur un vrai trajet : que l'IGN renvoie bien le tracé (`geometry`) et que la carte s'affiche.

## Périmètre

- Ajout : composant carte, tracé dans le trajet calculé, ADR 0006, dépendance `leaflet` (+ ses types).
- Tests existants complétés d'un tracé vide (`trace: []`) dans leurs exemples de trajet.
- Rien d'autre modifié. Carte hors connexion : reste pour la demande #6.
- Point noté, non corrigé : les tuiles de carte ne sont pas gardées en cache (prévu avec #6).

## Résultat des contrôles

`npx oxlint . && npx eslint . && npm run type-check && npm run test:unit -- --run && npm run build-only` :
code de retour 0 — lint sans erreur, types valides, 13 fichiers de tests / 96 tests réussis,
compilation réussie.
