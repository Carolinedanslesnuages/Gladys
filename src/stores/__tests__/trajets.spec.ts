import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTrajetsStore } from '../trajets'
import type { Lieu } from '@/services/adresses'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

const lieu = (libelle: string): Lieu => ({ libelle, latitude: 45, longitude: 4 })

describe('Trajets récents gardés sur l’appareil', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('ne garde rien tant que la personne n’a pas donné son accord', () => {
    const memoire = simulerLocalStorage()
    const magasin = useTrajetsStore()
    expect(magasin.accord).toBeNull()
    magasin.retenirTrajet(lieu('Lyon'), lieu('Vienne'))
    expect(magasin.trajetsRecents).toEqual([])
    expect(memoire.size).toBe(0)
  })

  it('ne garde rien si la personne refuse, et efface ce qui était gardé', () => {
    const memoire = simulerLocalStorage()
    const magasin = useTrajetsStore()
    magasin.choisirAccord('accepte')
    magasin.retenirTrajet(lieu('Lyon'), lieu('Vienne'))
    magasin.choisirAccord('refuse')
    magasin.retenirTrajet(lieu('Lyon'), lieu('Givors'))
    expect(magasin.trajetsRecents).toEqual([])
    expect(JSON.parse(memoire.get('leon:trajets-recents')!)).toEqual([])
    expect(JSON.parse(memoire.get('leon:accord-historique')!)).toBe('refuse')
  })

  it('garde les 5 derniers trajets, du plus récent au plus ancien, sans doublon', () => {
    simulerLocalStorage()
    const magasin = useTrajetsStore()
    magasin.choisirAccord('accepte')
    for (const arrivee of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) magasin.retenirTrajet(lieu('Lyon'), lieu(arrivee))
    magasin.retenirTrajet(lieu('Lyon'), lieu('A4'))
    expect(magasin.trajetsRecents.map((trajet) => trajet.arrivee.libelle)).toEqual(['A4', 'A6', 'A5', 'A3', 'A2'])
  })

  it('relit les trajets au démarrage, même hors connexion', () => {
    simulerLocalStorage({
      'leon:accord-historique': JSON.stringify('accepte'),
      'leon:trajets-recents': JSON.stringify([{ depart: lieu('Lyon'), arrivee: lieu('Vienne'), valideLe: '2026-11-16T10:00:00Z' }]),
    })
    expect(useTrajetsStore().trajetsRecents.map((trajet) => trajet.arrivee.libelle)).toEqual(['Vienne'])
  })

  it('efface les trajets à la demande', () => {
    const memoire = simulerLocalStorage()
    const magasin = useTrajetsStore()
    magasin.choisirAccord('accepte')
    magasin.retenirTrajet(lieu('Lyon'), lieu('Vienne'))
    magasin.effacerTrajets()
    expect(magasin.trajetsRecents).toEqual([])
    expect(JSON.parse(memoire.get('leon:trajets-recents')!)).toEqual([])
  })

  it('prévient si l’appareil refuse d’enregistrer', () => {
    simulerLocalStorage({}, true)
    const magasin = useTrajetsStore()
    magasin.choisirAccord('accepte')
    expect(magasin.erreur).toMatch(/n’a pas pu enregistrer/)
  })
})
