# 0006 — Carte du trajet (Leaflet, fond Plan IGN)

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Demande** : #16 « je veux voir l'itinéraire sur une carte » (mode libre)

## Contexte
La personne veut voir son trajet sur une carte avant de partir. Le service d'itinéraire de l'IGN
(ADR 0003) peut renvoyer le tracé du trajet. Il faut un outil pour afficher une carte déplaçable et
zoomable (doigts, boutons, clavier), et un fond de carte.

## Options
- **A. Leaflet + Plan IGN (WMTS de la Géoplateforme)** : bibliothèque libre, légère (~40 ko),
  utilisable au clavier (flèches, + et −) ; fond public, gratuit, sans compte.
- **B. MapLibre GL + tuiles vectorielles IGN** : rendu plus fin, mais bien plus lourd (~800 ko)
  et dépend de WebGL.
- **C. Image fixe du tracé** : ni déplacement ni zoom, contraire au choix du PO.

## Décision
**Option A**, d'après les choix du PO (plan validé) :
- seul le **trajet retenu pour la VSP** est tracé, avec un repère écrit « Départ » et « Arrivée » ;
- la carte s'ouvre **cadrée sur tout le trajet** ; on la déplace et zoome aux doigts, au clavier,
  ou avec deux boutons DSFR « Zoomer sur la carte » / « Dézoomer la carte » ;
- les demandes à l'IGN ajoutent `geometryFormat=geojson` ; le tracé est gardé avec le trajet
  calculé (store `itineraire`), sans nouvelle donnée personnelle ;
- seules les tuiles de la zone affichée sont demandées à `data.geopf.fr` ; elles ne sont pas
  mises en cache (hors connexion : demande #6) ;
- **sans réseau**, la carte n'est pas affichée : un message annoncé « Carte indisponible sans
  connexion » la remplace ; la liste des étapes reste l'alternative écrite à la carte ;
- molette désactivée (pas de piège au défilement de la page) ; animations coupées si
  `prefers-reduced-motion`.

## Conséquences
- **Positives** : carte publique sans compte ; utilisable au clavier ; l'information reste
  entièrement disponible par écrit (étapes).
- **Négatives** : une dépendance de plus (`leaflet`) ; la zone affichée est révélée au service
  de tuiles de l'IGN (comme le départ et l'arrivée l'étaient déjà au calcul, ADR 0003).
- **À vérifier sur un vrai trajet** : que l'IGN renvoie bien `geometry` en GeoJSON, et le
  confort du déplacement au doigt dans la page sur téléphone.
