# 0014 — Apparence propre à GLADYS, sans le système de design de l'État (DSFR)

- **Statut** : Accepted (remplace, pour l'apparence, les choix DSFR des ADR 0001 et 0011)
- **Date** : 2026-11-18
- **Story** : #33 « Retire complètement le DSFR de Gladys »

## Contexte
GLADYS est une application de navigation sur téléphone, pas un site de l'État. Le DSFR (bibliothèque,
police Marianne, classes `fr-…`, bleu France) donnait une apparence de site administratif et alourdissait
l'application (polices et styles à garder hors connexion).

## Décision (choix du PO)
- **Retrait complet** : bibliothèque `@gouvminint/vue-dsfr`, feuilles de style et police du DSFR, classes `fr-…`,
  bloc marque « République Française ». `ada.json` indique `"dsfr": false`.
- **Couleur principale** : vert route `#1F7A4D` (5,3:1 sur blanc, texte blanc dessus 5,3:1), à la place du bleu France.
- **Police** : celle du système (`system-ui`), lisible et sans téléchargement.
- **Composants recréés simplement** (`src/components/interface/`) : bouton, champ de saisie, alerte, pastille,
  choix unique (boutons radio), fenêtre (`<dialog>` natif), icônes. Chacun est accessible (RGAA) :
  - cibles d'au moins 44 px de haut ;
  - **intitulé visible pour chaque bouton** (plus de bouton à icône seule) ; le nom complet reste dans `aria-label` ;
  - étiquette visible reliée au champ, aide et erreur reliées par `aria-describedby`, erreur annoncée ;
  - information jamais par la couleur seule (icône et texte en plus).
- **Contrastes** : au moins 4,5:1 pour le texte ; les couleurs sont dans `src/styles/gladys.css`
  et vérifiées par un test (`src/__tests__/apparence.spec.ts`).
- **Logo** : tracé vert route, petite étoile à quatre branches conservée (jaune `#F2A900`).

## Conséquences
- **Positives** : apparence propre à GLADYS, application plus légère, plus rien d'institutionnel imposé.
- **Négatives** : les composants sont à maintenir par l'équipe ; les icônes PNG de l'application installée
  (écran d'accueil du téléphone) sont à régénérer en vert.
- **À surveiller** : la déclaration d'accessibilité ne s'appuie plus sur l'accessibilité native du DSFR ;
  un audit RGAA reste à faire.
