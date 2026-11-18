# 0010 — Accueil « carte plein écran », comme une application de navigation

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Demande** : #26 (conversation) — « que Gladys fonctionne comme une application de navigation,
  dans l'esprit de Waze ou de Google Maps, sans copier leur apparence »

## Contexte
L'accueil était un formulaire (départ, position, arrivée), la carte n'apparaissant qu'après le
calcul, au milieu du détail du trajet. La personne veut ouvrir GLADYS et voir d'abord la carte.

## Décision
- La carte (`CarteTrajet`) remplit **tout l'écran sous l'en-tête** dès l'arrivée : hauteur
  `100dvh` moins ce qui est au-dessus, mesuré à l'ouverture et quand la fenêtre change de taille.
  Elle existe sans trajet : France entière, puis centrée sur la personne si elle autorise sa position
  (`suivreDesLOuverture`). Un refus ne déclenche **aucune alerte** (rien n'a été demandé) : un
  message de statut le dit, « Me recentrer » relance la recherche.
- Ses boutons (recentrer, suivre, zoomer, plein écran) sont **posés sur la carte**, à droite, en
  icônes seules de 48 px sur fond blanc ; leur intitulé est dans `aria-label` (et `title`).
- Une seule barre **« Où allez-vous ? »** (`role="search"`) est posée en haut de la carte, et vient
  avant elle dans la page (ordre clavier). Le départ est **« Ma position »** par défaut : l'adresse
  la plus proche est cherchée en validant. Toucher « Ma position » ouvre le champ « Départ » ;
  « Utiliser ma position actuelle » y revient. En cas d'échec de la position, le champ s'ouvre avec
  l'erreur reliée.
- Barre touchée (focus dedans) et rien de tapé : les **trajets récents** s'affichent dessous ;
  Échap ou la sortie du focus les referment.
- Le détail (détour, calculateur, durée, comparaison, étapes, trajets récents) reste **sous la
  carte** : on y arrive en faisant défiler ; après validation, le focus y est porté. Le pied de page
  suit.
- Sur téléphone, l'en-tête DSFR reste compact : l'accroche se masque (le logo reste), les liens
  rapides sont dans le menu.

## Conséquences
- Le tracé change sans recréer la carte : il est redessiné à chaque nouveau calcul et montré en
  entier ; « Me recentrer » ramène sur la personne.
- La localisation est demandée dès l'ouverture : le navigateur pose la question une fois.
- Le calcul reste lancé par « Calculer mon itinéraire », sous la carte (le lancer dès le choix de la
  destination serait une prochaine étape).
