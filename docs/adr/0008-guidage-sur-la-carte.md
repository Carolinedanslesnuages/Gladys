# 0008 — Suivre sa position sur la carte pendant le trajet

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Demande** : #20 « On peut avoir une carte de navigation comme sur google ? » (conversation)

## Contexte
La personne veut une carte « comme un GPS » : se voir avancer sur son trajet. La carte du trajet
existe (ADR 0006). Les étapes reçues ne donnent ni consignes de virage ni position par étape :
un guidage « tournez à gauche » demanderait d'autres données.

## Décision
Première marche du guidage, calculée **sur l'appareil** :
- un bouton « Suivre ma position sur la carte » démarre la localisation continue du téléphone
  (`watchPosition`) ; « Arrêter de suivre ma position » la coupe ;
- un repère écrit « Vous » suit la personne ; la carte se centre sur elle (zoom 16) ;
- la **distance restante** jusqu'à l'arrivée est écrite, calculée le long du tracé depuis le point
  le plus proche ;
- à plus de **100 m** du tracé, une alerte écrite dit que la personne a quitté son trajet ;
- un rappel de sécurité : regarder la carte seulement à l'arrêt.

## Données personnelles
La position **ne quitte pas l'appareil** et n'est **pas enregistrée** : elle ne vit qu'en mémoire,
le temps du suivi. Seules les tuiles du fond de carte autour d'elle sont demandées à l'IGN (comme
en ADR 0006). La localisation s'arrête quand la personne le demande, quand la carte disparaît
(réseau coupé) ou quand elle quitte l'écran.

## Conséquences
- **Positives** : sans nouvelle dépendance ni nouveau service ; la position reste privée.
- **Négatives** : pas encore de consignes de virage ni de voix ; pas de nouveau calcul automatique
  quand on quitte le trajet ; écran allumé et GPS consomment la batterie.
- **À vérifier sur un vrai trajet** : la précision du GPS en VSP, et le confort de lecture en roulant.
