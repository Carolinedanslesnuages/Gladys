# 0011 — Application sans en-tête ni pied de page, panneau « À propos »

- **Statut** : Accepted
- **Date** : 2026-11-18
- **Demande** : #26 (conversation) — « Gladys est une application mobile, pas un site web : retire
  l'en-tête et le pied de page du DSFR, pour que la carte prenne tout l'écran »

## Contexte
L'en-tête et le pied de page DSFR sont faits pour un site. Sur téléphone, ils prenaient de la place
à la carte. GLADYS garde l'identité de l'État : couleurs, police Marianne, composants DSFR.

## Décision
- `App.vue` n'affiche plus `DsfrHeader` ni `DsfrFooter` : la carte occupe tout l'écran.
- Un bouton **« Menu »** (intitulé visible, `aria-haspopup="dialog"`) est posé en haut à droite de
  la carte, après la barre « Où allez-vous ? » dans l'ordre clavier.
- Il ouvre le panneau **« À propos de GLADYS »** (`DsfrModal`, titre `h2`) : logo Gladys, bloc
  marque « République Française » (`DsfrLogo`), lien vers « Relevés », déclaration
  d'accessibilité, mentions légales, données personnelles (dont la position) et cookies.
- Le panneau se ferme par « Fermer » ou Échap ; le focus revient sur « Menu ».
- L'écran « Relevés » a un lien « Retour à la carte ».

## Conséquences
- La déclaration d'accessibilité dit **« non conforme »** tant qu'aucun audit RGAA n'est fait.
- Les mentions légales (éditeur, directeur de la publication, hébergeur) et l'adresse de contact
  sont **à compléter** avant l'ouverture au public.
- GLADYS ne dépose aucun cookie : il n'y a pas de bandeau de consentement.
