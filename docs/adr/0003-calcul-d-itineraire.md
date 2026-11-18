# 0003 — Calcul d'itinéraire adapté à une voiture sans permis

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Story** : #3 « Calculer un itinéraire adapté à ma VSP »

## Contexte
Une voiture sans permis n'a pas le droit de rouler sur autoroute ni voie rapide, et les routes
départementales y sont dangereuses. L'appli doit calculer un trajet qui exclut les premières et
évite les secondes tant que le détour reste acceptable. Le calcul ne peut pas se faire sur
l'appareil : le départ et l'arrivée doivent être envoyés à un service.

## Options
- **A. Service d'itinéraire de l'IGN** (Géoplateforme, `https://data.geopf.fr/navigation/itineraire`,
  public, gratuit, sans compte) : interdiction des autoroutes, évitement des départementales.
- **B. Un service commercial** : compte, clé secrète, conditions d'usage des données.

## Décision
**Option A**, choisie par le PO.
- Seules les coordonnées du départ et de l'arrivée sont envoyées. Rien d'autre ne quitte l'appareil.
- Deux demandes par calcul (ressource `bdtopo-pgr`, profil voiture, trajet le plus court), toutes
  deux avec `banned wayType = autoroute` : le trajet le plus court sans autoroute, et celui qui
  évite en plus les départementales (`avoid cpx_classement_administratif = departementale`).
- Les kilomètres sur départementale sont comptés sur les étapes dont le numéro de route commence
  par « D » (ou « RD »).
- Le trajet qui évite les départementales est retenu si son détour ne dépasse pas le **seuil choisi
  par la personne** (10, 20, 30 ou 50 % ; 30 % par défaut), gardé sur l'appareil (`localStorage`,
  clé `seuil-detour`, sans donnée personnelle).
- S'il n'existe aucun trajet sans départementale, l'appli le dit et propose quand même le trajet
  qui en a le moins, avec ses kilomètres de départementale.
- Sans réseau, le calcul est désactivé avec un message ; l'itinéraire calculé n'est pas gardé.

## Conséquences
- **Positives** : service public sans compte ni secret ; règles de sécurité appliquées à chaque calcul.
- **Négatives** : pas de calcul hors connexion ; deux demandes par calcul.
- **À vérifier sur de vrais trajets** : que `wayType = autoroute` couvre bien les voies rapides
  (« type autoroutier » de la BD TOPO), que la clé d'évitement des départementales est acceptée par
  le service, et que le numéro « D… » figure bien dans les étapes renvoyées.
