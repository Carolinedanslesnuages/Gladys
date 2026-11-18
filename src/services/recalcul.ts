/**
 * Recalcul du chemin quand la personne a quitté son trajet : on cherche le prochain village du
 * trajet, puis on recolle le nouveau chemin à la suite du trajet d'origine. Calculs faits sur
 * l'appareil ; seul le calcul du nouveau chemin a besoin du réseau.
 */
import { distanceEntre } from '@/services/guidage'
import { avecLesVirages } from '@/services/consignes'
import type { Coordonnees } from '@/services/position'
import type { Etape, Itineraire, PointDuTrace, ResultatItineraire } from '@/services/itineraire'

/** Le prochain village du trajet : son nom, où le trajet y entre, et les étapes qui restent à partir de là. */
export interface VillageSuivant {
  /** Nom du village, ou `null` quand il ne reste que l'arrivée (aucun autre village connu). */
  nom: string | null
  /** Rang, dans le tracé d'origine, du point où le trajet entre dans ce village (ou de l'arrivée). */
  rangDansLeTrace: number
  /** Rang de la première étape d'origine conservée après le nouveau chemin. */
  rangPremiereEtapeConservee: number
}

function rangDuPointLePlusProche(position: Coordonnees, trace: PointDuTrace[]): number {
  let rangLePlusProche = 0
  let ecartLePlusPetit = Infinity
  trace.forEach((point, rang) => {
    const ecart = distanceEntre(position, point)
    if (ecart < ecartLePlusPetit) {
      ecartLePlusPetit = ecart
      rangLePlusProche = rang
    }
  })
  return rangLePlusProche
}

/**
 * Le prochain village du trajet, devant la personne : la première étape, après celle en cours, qui
 * se passe dans un autre village. Sans autre village, c'est l'arrivée. `null` sans tracé ni consignes.
 */
export function villageSuivant(position: Coordonnees, etapes: Etape[], trace: PointDuTrace[]): VillageSuivant | null {
  if (trace.length < 2 || etapes.length === 0 || etapes.some((etape) => etape.rangFinDansLeTrace === undefined)) {
    return null
  }
  const rangDansLeTraceActuel = rangDuPointLePlusProche(position, trace)
  const rangEtapeCourante = Math.max(
    0,
    etapes.findIndex((etape) => etape.rangFinDansLeTrace! >= rangDansLeTraceActuel),
  )
  const communeCourante = etapes[rangEtapeCourante]!.commune
  const rangEtapeDuVillage = etapes.findIndex(
    (etape, rang) => rang > rangEtapeCourante && etape.commune !== null && etape.commune !== communeCourante,
  )
  if (rangEtapeDuVillage === -1) {
    return { nom: null, rangDansLeTrace: trace.length - 1, rangPremiereEtapeConservee: etapes.length }
  }
  return {
    nom: etapes[rangEtapeDuVillage]!.commune,
    rangDansLeTrace: etapes[rangEtapeDuVillage - 1]!.rangFinDansLeTrace!,
    rangPremiereEtapeConservee: rangEtapeDuVillage,
  }
}

/** Les tronçons d'origine qui restent après avoir parcouru `distanceDejaCouverteMetres`. */
function tronconsRestants(itineraire: Itineraire, distanceDejaCouverteMetres: number) {
  let distanceCumulee = 0
  return itineraire.troncons.filter((troncon) => {
    distanceCumulee += troncon.distanceMetres
    return distanceCumulee > distanceDejaCouverteMetres
  })
}

/**
 * Le trajet d'origine dont le début est remplacé par le nouveau chemin, calculé jusqu'au village
 * suivant. Le reste du trajet (après ce village) est gardé tel quel.
 */
export function remplacerLeDebutDuTrajet(
  trajetDOrigine: ResultatItineraire,
  nouveauChemin: ResultatItineraire,
  village: VillageSuivant,
): ResultatItineraire {
  const origine = trajetDOrigine.itineraire
  const etapesConservees = origine.etapes.slice(village.rangPremiereEtapeConservee)
  const distanceConservee = etapesConservees.reduce((total, etape) => total + etape.distanceMetres, 0)
  const distanceAbandonnee = origine.etapes
    .slice(0, village.rangPremiereEtapeConservee)
    .reduce((total, etape) => total + etape.distanceMetres, 0)
  const trace = [...nouveauChemin.itineraire.trace, ...origine.trace.slice(village.rangDansLeTrace + 1)]
  const itineraire: Itineraire = {
    distanceMetres: nouveauChemin.itineraire.distanceMetres + distanceConservee,
    departementaleFortTraficMetres:
      nouveauChemin.itineraire.departementaleFortTraficMetres +
      etapesConservees.filter((etape) => etape.fortTrafic).reduce((total, etape) => total + etape.distanceMetres, 0),
    troncons: [...nouveauChemin.itineraire.troncons, ...tronconsRestants(origine, distanceAbandonnee)],
    etapes: avecLesVirages([...nouveauChemin.itineraire.etapes, ...etapesConservees], trace),
    trace,
  }
  return {
    itineraire,
    plusCourt: itineraire,
    retenuEstLePlusCourt: true,
    sansDepartementalePossible: nouveauChemin.sansDepartementalePossible,
    detourTropLong: false,
  }
}
