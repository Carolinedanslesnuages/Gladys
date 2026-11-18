# 0009 — Fond de carte OpenStreetMap à la place du Plan IGN

- **Statut** : Accepted (remplace le choix du fond de carte de l'ADR 0006)
- **Date** : 2026-11-18
- **Demande** : #26 « je veux une carte open street map car ign ne permet pas d'avoir le véhicule vraiment centré »

## Contexte
Pendant le suivi (ADR 0008), le PO constate qu'avec le fond Plan IGN le véhicule ne paraît pas
vraiment centré. Il demande un fond OpenStreetMap.

## Options
- **A. Tuiles raster OpenStreetMap** (`tile.openstreetmap.org`) avec Leaflet : aucun changement
  de bibliothèque, sans compte, zoom jusqu'à 19 (contre 18 retenu pour l'IGN).
- **B. Garder le Plan IGN** et chercher la cause du décalage : contraire au choix du PO.
- **C. Tuiles vectorielles OpenStreetMap (MapLibre GL)** : plus lourd, dépend de WebGL (cf. ADR 0006).

## Décision
**Option A.** Seul le fond change : tracé, repères, suivi, plein écran et accessibilité restent
identiques. La mention « © les contributeurs d'OpenStreetMap », obligatoire (licence ODbL), est
affichée avec un lien vers leurs conditions, dans la même fenêtre.

## Conséquences
- **Positives** : un zoom de plus pour lire les rues ; pas de nouvelle dépendance.
- **Négatives** : la zone affichée est révélée aux serveurs de la fondation OpenStreetMap (au lieu
  de l'IGN). Leur politique d'usage interdit un trafic important : si GLADYS est largement
  diffusée, prévoir un fournisseur de tuiles OpenStreetMap dédié.
- **À vérifier sur téléphone** : que le véhicule apparaît bien au centre pendant le suivi.
