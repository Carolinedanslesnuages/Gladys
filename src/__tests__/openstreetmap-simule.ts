/**
 * Faux services pour les tests du calcul OpenStreetMap : le calculateur (trajets et routes
 * empruntées), la Base Adresse Nationale (communes par position) et le découpage administratif.
 */
import type { PointDuTrace } from '@/services/itineraire'

/** Un tronçon simulé : sa longueur, sa classe OpenStreetMap, ses noms et sa commune. */
export interface TronconSimule {
  kilometres: number
  classe: string
  noms: string[]
  codeCommune?: string
  /** Vrai : aucune adresse près du tronçon, seul le découpage administratif connaît sa commune. */
  loinDesAdresses?: boolean
}

export interface TrajetsSimules {
  plusCourt: TronconSimule[]
  fuyantLesGrandsAxes: TronconSimule[]
}

const encoderNombre = (valeur: number): string => {
  let nombre = valeur < 0 ? ~(valeur << 1) : valeur << 1
  let texte = ''
  while (nombre >= 0x20) {
    texte += String.fromCharCode((0x20 | (nombre & 0x1f)) + 63)
    nombre >>= 5
  }
  return texte + String.fromCharCode(nombre + 63)
}

/** Polyligne codée à 6 décimales, comme celles du calculateur OpenStreetMap. */
export function encoderTrace(points: PointDuTrace[]): string {
  let latitudePrecedente = 0
  let longitudePrecedente = 0
  return points
    .map((point) => {
      const latitude = Math.round(point.latitude * 1e6)
      const longitude = Math.round(point.longitude * 1e6)
      const morceau = encoderNombre(latitude - latitudePrecedente) + encoderNombre(longitude - longitudePrecedente)
      latitudePrecedente = latitude
      longitudePrecedente = longitude
      return morceau
    })
    .join('')
}

const cleDuPoint = (latitude: number) => String(Math.round(latitude * 1e6))

/** Un point par tronçon (là où il commence), plus l'arrivée ; chaque trajet a ses propres latitudes. */
const pointsDuTrajet = (troncons: TronconSimule[], rangDuTrajet: number): PointDuTrace[] =>
  [...troncons, null].map((_troncon, rang) => ({ latitude: 45 + rangDuTrajet * 0.1 + rang * 0.001, longitude: 4.8 }))

export function simulerOpenStreetMap(trajets: TrajetsSimules, nomsDesCommunes: Record<string, string>) {
  const traces = [trajets.plusCourt, trajets.fuyantLesGrandsAxes].map((troncons, rangDuTrajet) => {
    const points = pointsDuTrajet(troncons, rangDuTrajet)
    return { troncons, points, traceCodee: encoderTrace(points) }
  })
  const tronconParPoint = new Map(
    traces.flatMap((trace) => trace.troncons.map((troncon, rang) => [cleDuPoint(trace.points[rang]!.latitude), troncon] as const)),
  )
  const json = (contenu: unknown) => Promise.resolve(new Response(JSON.stringify(contenu)))

  return async (adresse: string, options?: RequestInit): Promise<Response> => {
    const corps = typeof options?.body === 'string' ? JSON.parse(options.body) : null
    if (adresse.endsWith('/route')) {
      const trace = corps.costing_options.motor_scooter.shortest ? traces[0]! : traces[1]!
      const kilometres = trace.troncons.reduce((total, troncon) => total + troncon.kilometres, 0)
      return json({ trip: { summary: { length: kilometres }, legs: [{ shape: trace.traceCodee }] } })
    }
    if (adresse.endsWith('/trace_attributes')) {
      const trace = traces.find((traceConnue) => traceConnue.traceCodee === corps.encoded_polyline)!
      return json({
        shape: trace.traceCodee,
        edges: trace.troncons.map((troncon, rang) => ({
          length: troncon.kilometres,
          road_class: troncon.classe,
          names: troncon.noms,
          speed: 50,
          begin_shape_index: rang,
        })),
      })
    }
    if (adresse.endsWith('/reverse/csv')) {
      const formulaire = options?.body as FormData
      const lignes = (await (formulaire.get('data') as Blob).text()).trim().split('\n').slice(1)
      const reponses = lignes.map((ligne) => {
        const [latitude, longitude] = ligne.split(',')
        const troncon = tronconParPoint.get(cleDuPoint(Number(latitude)))
        return `${latitude},${longitude},${troncon && !troncon.loinDesAdresses ? (troncon.codeCommune ?? '') : ''}`
      })
      return new Response(`lat,lon,result_citycode\n${reponses.join('\n')}\n`)
    }
    const url = new URL(adresse)
    if (url.hostname === 'geo.api.gouv.fr' && url.searchParams.has('lat')) {
      const troncon = tronconParPoint.get(cleDuPoint(Number(url.searchParams.get('lat'))))
      return json(troncon?.codeCommune ? [{ code: troncon.codeCommune }] : [])
    }
    if (url.hostname === 'geo.api.gouv.fr') {
      const nom = nomsDesCommunes[url.pathname.split('/').pop() ?? '']
      return nom ? json({ nom }) : new Response('{}', { status: 404 })
    }
    return new Response('{}', { status: 404 })
  }
}
