import type { Etape, Itineraire, PointDuTrace, ResultatItineraire } from '@/services/itineraire'
import { avecLesVirages } from '@/services/consignes'

const PAS_EN_DEGRES = 0.001 // environ 111 m

const ecartsRegulierement = (nombreDePas: number) =>
  Array.from({ length: nombreDePas + 1 }, (_vide, rang) => rang * PAS_EN_DEGRES)

/** Dix pas vers le nord (environ 1,1 km), puis dix pas vers l'est ou l'ouest (environ 0,8 km). */
export function traceAvecUnVirage(versLEst: boolean): PointDuTrace[] {
  const versLeNord = ecartsRegulierement(10).map((ecart) => ({ latitude: 45 + ecart, longitude: 4 }))
  const suite = ecartsRegulierement(10)
    .slice(1)
    .map((ecart) => ({ latitude: 45.01, longitude: 4 + (versLEst ? ecart : -ecart) }))
  return [...versLeNord, ...suite]
}

const etape = (route: string, commune: string, distanceMetres: number): Etape => ({
  codeCommune: null,
  commune,
  route,
  departementale: false,
  fortTrafic: false,
  distanceMetres,
})

/** Un trajet de deux étapes : la rue de Lyon vers le nord, puis la D12 vers l'est, jusqu'à Saint-Martin. */
export function trajetSimule(): ResultatItineraire {
  const trace = traceAvecUnVirage(true)
  const itineraire: Itineraire = {
    distanceMetres: 1900,
    departementaleFortTraficMetres: 0,
    troncons: [],
    etapes: avecLesVirages([etape('Rue de Lyon', 'Lyon', 1112), etape('D12', 'Saint-Martin', 786)], trace),
    trace,
  }
  return {
    itineraire,
    plusCourt: itineraire,
    retenuEstLePlusCourt: true,
    sansDepartementalePossible: true,
    detourTropLong: false,
  }
}

/** Le même trajet tel qu'il était enregistré avant les consignes : sans rang de fin ni virage. */
export function trajetSimuleAncien(): ResultatItineraire {
  const trajet = trajetSimule()
  const etapesAnciennes = trajet.itineraire.etapes.map((etapeComplete) => ({
    codeCommune: etapeComplete.codeCommune,
    commune: etapeComplete.commune,
    route: etapeComplete.route,
    departementale: etapeComplete.departementale,
    fortTrafic: etapeComplete.fortTrafic,
    distanceMetres: etapeComplete.distanceMetres,
  }))
  const itineraire = { ...trajet.itineraire, etapes: etapesAnciennes }
  return { ...trajet, itineraire, plusCourt: itineraire }
}
