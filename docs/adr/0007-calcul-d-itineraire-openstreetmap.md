# 0007 — Essai d'OpenStreetMap pour le calcul d'itinéraire, à côté de l'IGN

- **Statut** : Accepted (essai)
- **Date** : 2026-11-18
- **Demande** : #18 « Conversation : les étapes de mon projet »

## Contexte
Le service de l'IGN (ADR 0003) ne sait éviter que **toutes** les routes importantes d'un coup
(`avoid importance < 4`, une simple préférence) : il garde parfois des bouts de grands axes. Le PO
veut essayer un calculateur fondé sur OpenStreetMap, qui sait mieux fuir les seuls grands axes.
Aucun des deux ne compte le trafic réel : tous deux classent les routes par importance.

## Options
- **A. Valhalla public de l'association FOSSGIS** (`https://valhalla1.openstreetmap.de`, sans
  compte ni clé, celui qu'utilise le site openstreetmap.org) : profil « cyclomoteur »
  (`motor_scooter`, 45 km/h, interdit sur autoroute), préférence `use_primary`, classe de chaque
  route via `trace_attributes`.
- **B. OSRM public** : ne sait exclure que les autoroutes, pas les grands axes.
- **C. GraphHopper, ORS** : compte et clé secrète obligatoires.

## Décision
**Option A, en essai, au choix de la personne** : « Calculateur d'itinéraire : IGN /
OpenStreetMap (en essai) ». L'IGN reste le choix par défaut. Le choix est gardé sur l'appareil
(`localStorage`, clé `calculateur`, sans donnée personnelle).
- Deux trajets, demandés l'un après l'autre (le service public demande d'éviter les rafales) :
  le plus court (`shortest: true`) et celui qui fuit les routes principales (`use_primary: 0`).
  Chacun est décrit route par route (`trace_attributes`), puis comparé selon le seuil de détour,
  comme avec l'IGN (`choisirItineraire`).
- **Autres chemins** (ajout du 2026-11-18, retour du PO : « il me fait prendre un grand axe
  orangé-jaune alors qu'il existe un autre chemin ») : `use_primary` ne fuit que les routes
  principales (orange sur la carte), pas les secondaires (jaune). La demande qui fuit les grands
  axes réclame donc deux autres chemins (`alternates: 2`), décrits l'un après l'autre ; on garde
  le moins chargé en fort trafic qui tient dans le détour accepté (`leMoinsCharge`).
- **Même règle de trafic que l'ADR 0003** : la classe OpenStreetMap est ramenée à l'importance
  BD TOPO (route principale ou secondaire : 2-3, fort trafic ; tertiaire et moins : calme).
  Départementale : un nom « D… » parmi ceux de la route, ou « M… » pour les anciennes
  départementales cédées à une métropole (la D974 devient M974 dans Dijon), IGN compris.
- Un trajet qui emprunterait une autoroute est écarté ; si le plus court en emprunte une, le
  calcul échoue avec un message.
- **Villages** : la commune de chaque tronçon vient de la Base Adresse Nationale (IGN,
  `/geocodage/reverse/csv`, une seule demande avec le point de départ de chaque tronçon du trajet
  retenu). Loin de toute adresse, on demande au découpage administratif (`geo.api.gouv.fr`,
  `communes?lat&lon`), une fois par suite de tronçons sur la même route. Les noms viennent ensuite
  comme dans l'ADR 0005.
- Chaque demande abandonne au bout de 20 secondes : la personne n'attend jamais sans fin.
- Le résultat dit avec quel calculateur il a été obtenu, avec la mention « © les contributeurs
  d'OpenStreetMap » (licence ODbL).

## Conséquences
- **Données qui quittent l'appareil** : le départ et l'arrivée partent chez FOSSGIS (association
  allemande, serveurs dans l'Union européenne) ; les points du trajet retenu partent vers les
  services publics de l'IGN et de l'État. Rien d'autre, aucun compte.
- **Négatives** : service gratuit, sans garantie de disponibilité, qui ralentit ou refuse les
  connexions en cas d'usage intensif (constaté pendant les essais) ; trajets de 200 km au plus ;
  jusqu'à six demandes au calculateur par trajet, plus lent que l'IGN.
- **Constaté sur un vrai trajet** (Dijon → Beaune) : 49,9 km dont 3,4 km à fort trafic, contre
  39,3 km dont 29 km pour le plus court ; détour de 27 %, accepté à 30 %. Avec les autres
  chemins et les routes « M… » comptées : le premier chemin fuyant (46,6 km) garde environ 14 km
  de routes secondaires chargées, un autre (49,8 km) environ 9 km ; c'est lui qui est retenu.
- **À décider après l'essai** : garder les deux, passer à OpenStreetMap seul, ou héberger notre
  propre calculateur si l'usage grandit.
