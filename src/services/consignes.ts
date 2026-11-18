/**
 * Consignes de conduite, calculées sur l'appareil à partir du tracé et des étapes du trajet : le
 * sens du virage à la fin de chaque étape, puis la consigne à afficher selon la position. Aucun
 * réseau, rien ne quitte l'appareil. Décision : docs/adr/0015-consignes-de-conduite.md.
 */
import { capEntre, distanceEntre } from '@/services/guidage'
import type { Coordonnees } from '@/services/position'
import type { Etape, PointDuTrace, Virage } from '@/services/itineraire'

/** À moins de cette distance de la fin de l'étape en cours, on passe à la consigne suivante. */
export const DISTANCE_DE_BASCULE_METRES = 100

/** On lit la direction de la route sur ces mètres avant et après le virage. */
const DISTANCE_DE_LECTURE_METRES = 30
/** En dessous de ce changement de direction (degrés), on continue tout droit. */
const ANGLE_TOUT_DROIT_DEGRES = 30
/** Au-delà de ce changement de direction (degrés), c'est un demi-tour. */
const ANGLE_DEMI_TOUR_DEGRES = 150

const VERBES_DE_VIRAGE: Record<Virage, string> = {
  droite: 'Tournez à droite',
  gauche: 'Tournez à gauche',
  'tout-droit': 'Continuez tout droit',
  'demi-tour': 'Faites demi-tour',
}

/** Sens du virage entre la route avant un point du tracé et la route après lui. */
export function sensDuVirage(trace: PointDuTrace[], rangDuVirage: number): Virage {
  const pointDuVirage = trace[rangDuVirage]!
  let rangAvant = rangDuVirage
  while (rangAvant > 0 && distanceEntre(trace[rangAvant]!, pointDuVirage) < DISTANCE_DE_LECTURE_METRES) rangAvant -= 1
  let rangApres = rangDuVirage
  while (rangApres < trace.length - 1 && distanceEntre(pointDuVirage, trace[rangApres]!) < DISTANCE_DE_LECTURE_METRES)
    rangApres += 1
  if (rangAvant === rangDuVirage || rangApres === rangDuVirage) return 'tout-droit'
  const changement =
    ((capEntre(pointDuVirage, trace[rangApres]!) - capEntre(trace[rangAvant]!, pointDuVirage) + 540) % 360) - 180
  if (Math.abs(changement) < ANGLE_TOUT_DROIT_DEGRES) return 'tout-droit'
  if (Math.abs(changement) > ANGLE_DEMI_TOUR_DEGRES) return 'demi-tour'
  return changement > 0 ? 'droite' : 'gauche'
}

/** Rang, dans le tracé, du point où chaque étape se termine (les distances des étapes suivent le tracé). */
function rangsDeFinDesEtapes(etapes: Etape[], trace: PointDuTrace[]): number[] {
  const distancesCumulees = [0]
  for (let rang = 1; rang < trace.length; rang += 1)
    distancesCumulees.push(distancesCumulees[rang - 1]! + distanceEntre(trace[rang - 1]!, trace[rang]!))
  const longueurDuTrace = distancesCumulees[distancesCumulees.length - 1]!
  const longueurDesEtapes = etapes.reduce((total, etape) => total + etape.distanceMetres, 0)
  const echelle = longueurDesEtapes > 0 ? longueurDuTrace / longueurDesEtapes : 1
  let distanceDeFin = 0
  return etapes.map((etape, rangEtape) => {
    distanceDeFin += etape.distanceMetres * echelle
    if (rangEtape === etapes.length - 1) return trace.length - 1
    // Le point du tracé le plus proche de la distance où l'étape se termine.
    let rangDeFin = 0
    distancesCumulees.forEach((distance, rang) => {
      if (Math.abs(distance - distanceDeFin) < Math.abs(distancesCumulees[rangDeFin]! - distanceDeFin)) rangDeFin = rang
    })
    return rangDeFin
  })
}

/** Les étapes avec, pour chacune, où elle finit sur le tracé et le sens du virage à cet endroit. Sans tracé, inchangées. */
export function avecLesVirages(etapes: Etape[], trace: PointDuTrace[]): Etape[] {
  if (trace.length < 2 || etapes.length === 0) return etapes
  const rangsDeFin = rangsDeFinDesEtapes(etapes, trace)
  return etapes.map((etape, rangEtape) => ({
    ...etape,
    rangFinDansLeTrace: rangsDeFin[rangEtape]!,
    virageALaFin: rangEtape === etapes.length - 1 ? null : sensDuVirage(trace, rangsDeFin[rangEtape]!),
  }))
}

/** Vrai si les étapes portent leurs consignes (faux pour un trajet enregistré avant cette fonction). */
export const consignesDisponibles = (etapes: Etape[]): boolean =>
  etapes.length > 0 && etapes.every((etape) => etape.rangFinDansLeTrace !== undefined)

export interface Consigne {
  /** Ce qu'il faut faire, en toutes lettres : « Tournez à droite vers Saint-Martin ». */
  texte: string
  /** Ce qu'il reste à parcourir avant cette consigne. */
  distanceMetres: number
  /** Vrai pour la dernière : l'arrivée. */
  estLArrivee: boolean
}

/** « vers Saint-Martin » si le village change, sinon « sur la D12 ». */
function destinationDuVirage(etapeCourante: Etape, etapeSuivante: Etape): string {
  if (etapeSuivante.commune && etapeSuivante.commune !== etapeCourante.commune) return `vers ${etapeSuivante.commune}`
  return `sur ${etapeSuivante.route}`
}

function consigneALaFinDeLEtape(etapes: Etape[], rangEtape: number): { texte: string; estLArrivee: boolean } {
  const etapeSuivante = etapes[rangEtape + 1]
  if (!etapeSuivante) return { texte: 'Vous arrivez à destination', estLArrivee: true }
  const verbe = VERBES_DE_VIRAGE[etapes[rangEtape]!.virageALaFin ?? 'tout-droit']
  return { texte: `${verbe} ${destinationDuVirage(etapes[rangEtape]!, etapeSuivante)}`, estLArrivee: false }
}

const distanceSurLeTrace = (trace: PointDuTrace[], rangDeDepart: number, rangDArrivee: number): number => {
  let distance = 0
  for (let rang = rangDeDepart; rang < rangDArrivee; rang += 1) distance += distanceEntre(trace[rang]!, trace[rang + 1]!)
  return distance
}

/**
 * La consigne à afficher à cette position : le virage qui termine l'étape en cours, avec la distance
 * qui en reste. À moins de 100 m de la fin de l'étape, on passe à la consigne suivante.
 * `null` sans consignes (trajet ancien) ou sans tracé.
 */
export function consigneALaPosition(position: Coordonnees, etapes: Etape[], trace: PointDuTrace[]): Consigne | null {
  if (trace.length < 2 || !consignesDisponibles(etapes)) return null
  let rangDuTracePlusProche = 0
  let ecartLePlusPetit = Infinity
  trace.forEach((point, rang) => {
    const ecart = distanceEntre(position, point)
    if (ecart < ecartLePlusPetit) {
      ecartLePlusPetit = ecart
      rangDuTracePlusProche = rang
    }
  })
  let rangEtape = etapes.findIndex((etape) => etape.rangFinDansLeTrace! >= rangDuTracePlusProche)
  if (rangEtape === -1) rangEtape = etapes.length - 1
  const distanceALaFin = distanceSurLeTrace(trace, rangDuTracePlusProche, etapes[rangEtape]!.rangFinDansLeTrace!)
  const derniereEtape = rangEtape === etapes.length - 1
  if (!derniereEtape && distanceALaFin < DISTANCE_DE_BASCULE_METRES) {
    rangEtape += 1
    const distanceALaFinSuivante = distanceSurLeTrace(trace, rangDuTracePlusProche, etapes[rangEtape]!.rangFinDansLeTrace!)
    return { ...consigneALaFinDeLEtape(etapes, rangEtape), distanceMetres: distanceALaFinSuivante }
  }
  return { ...consigneALaFinDeLEtape(etapes, rangEtape), distanceMetres: distanceALaFin }
}

/** Distance lisible d'un coup d'œil : « 350 m » (à 10 m près), puis « 1,2 km ». */
export function distanceLisible(metres: number): string {
  if (metres < 1000) return `${Math.max(0, Math.round(metres / 10) * 10)} m`
  return `${(metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
}
