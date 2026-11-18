import { describe, it, expect } from 'vitest'
import {
  avecLesVirages,
  consigneALaPosition,
  consignesDisponibles,
  distanceLisible,
  sensDuVirage,
} from '../consignes'
import { avecLesEtapesDuTrajetRetenu } from '../itineraire'
import { traceAvecUnVirage, trajetSimule, trajetSimuleAncien } from '@/__tests__/trajet-simule'

const RANG_DU_VIRAGE = 10

describe('Sens du virage', () => {
  it('tourne à droite quand la route part vers l’est après le nord', () => {
    expect(sensDuVirage(traceAvecUnVirage(true), RANG_DU_VIRAGE)).toBe('droite')
  })

  it('tourne à gauche quand la route part vers l’ouest après le nord', () => {
    expect(sensDuVirage(traceAvecUnVirage(false), RANG_DU_VIRAGE)).toBe('gauche')
  })

  it('continue tout droit sur une route droite', () => {
    const routeDroite = Array.from({ length: 11 }, (_vide, rang) => ({ latitude: 45 + rang * 0.001, longitude: 4 }))
    expect(sensDuVirage(routeDroite, 5)).toBe('tout-droit')
  })

  it('fait demi-tour quand la route revient sur ses pas', () => {
    const allerRetour = [
      ...Array.from({ length: 11 }, (_vide, rang) => ({ latitude: 45 + rang * 0.001, longitude: 4 })),
      ...Array.from({ length: 10 }, (_vide, rang) => ({ latitude: 45.01 - (rang + 1) * 0.001, longitude: 4.00001 })),
    ]
    expect(sensDuVirage(allerRetour, RANG_DU_VIRAGE)).toBe('demi-tour')
  })
})

describe('Étapes avec leurs virages', () => {
  it('donne à chaque étape sa fin sur le tracé et son virage, sauf la dernière', () => {
    const [premiere, derniere] = trajetSimule().itineraire.etapes
    expect(premiere).toMatchObject({ rangFinDansLeTrace: RANG_DU_VIRAGE, virageALaFin: 'droite' })
    expect(derniere).toMatchObject({ rangFinDansLeTrace: 20, virageALaFin: null })
  })

  it('les étapes retenues d’un calcul d’itinéraire portent leurs virages (donc aussi hors connexion)', () => {
    const { itineraire } = trajetSimule()
    const sansVirages = { ...trajetSimuleAncien() }
    const resultat = avecLesEtapesDuTrajetRetenu(sansVirages, trajetSimuleAncien().itineraire.etapes)
    expect(resultat.itineraire.etapes.map((etape) => etape.virageALaFin)).toEqual(['droite', null])
    expect(resultat.itineraire.trace).toEqual(itineraire.trace)
  })

  it('reconnaît un trajet enregistré avant les consignes', () => {
    expect(consignesDisponibles(trajetSimule().itineraire.etapes)).toBe(true)
    expect(consignesDisponibles(trajetSimuleAncien().itineraire.etapes)).toBe(false)
  })

  it('laisse les étapes telles quelles sans tracé', () => {
    const { etapes } = trajetSimuleAncien().itineraire
    expect(avecLesVirages(etapes, [])).toBe(etapes)
  })
})

describe('Consigne selon la position', () => {
  const { itineraire } = trajetSimule()
  const consigne = (latitude: number, longitude: number) =>
    consigneALaPosition({ latitude, longitude }, itineraire.etapes, itineraire.trace)

  it('au départ, annonce le virage avec le sens et le village', () => {
    expect(consigne(45, 4)).toMatchObject({ texte: 'Tournez à droite vers Saint-Martin', estLArrivee: false })
    expect(consigne(45, 4)!.distanceMetres).toBeGreaterThan(1050)
  })

  it('met la distance à jour quand on avance', () => {
    const auDepart = consigne(45, 4)!.distanceMetres
    const plusLoin = consigne(45.005, 4)!.distanceMetres
    expect(plusLoin).toBeLessThan(auDepart - 500)
  })

  it('reste sur la même consigne à plus de 100 m de la fin de l’étape', () => {
    expect(consigne(45.0085, 4)!.texte).toBe('Tournez à droite vers Saint-Martin')
  })

  it('passe à la consigne suivante à moins de 100 m de la fin de l’étape', () => {
    // 45,0095 : environ 55 m avant le virage.
    expect(consigne(45.0095, 4)).toMatchObject({ texte: 'Vous arrivez à destination', estLArrivee: true })
  })

  it('dit « sur la route » quand le village ne change pas', () => {
    const memeVillage = itineraire.etapes.map((etape) => ({ ...etape, commune: 'Lyon' }))
    expect(consigneALaPosition({ latitude: 45, longitude: 4 }, memeVillage, itineraire.trace)!.texte).toBe(
      'Tournez à droite sur D12',
    )
  })

  it('ne donne aucune consigne pour un trajet enregistré avant les consignes', () => {
    const ancien = trajetSimuleAncien().itineraire
    expect(consigneALaPosition({ latitude: 45, longitude: 4 }, ancien.etapes, ancien.trace)).toBeNull()
  })
})

describe('Distance lisible', () => {
  it('arrondit à 10 m sous le kilomètre, puis passe en kilomètres', () => {
    expect(distanceLisible(347)).toBe('350 m')
    expect(distanceLisible(1240)).toBe('1,2 km')
  })
})
