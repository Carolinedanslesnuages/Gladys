import { describe, it, expect } from 'vitest'
import {
  dateDeDepart,
  dureeEnMinutes,
  formaterDuree,
  formaterEcartDeDuree,
  formaterHeure,
  heureDArrivee,
  vitesseValide,
} from '../duree'

describe('Durée d’un trajet en voiture sans permis', () => {
  it('Critère 1 : 45 km/h au plus, et la vitesse de la route si elle est plus basse', () => {
    // 15 km sur une route à 30 km/h : 30 min ; 15 km sur une route à 80 km/h : comptés à 45 km/h, 20 min.
    expect(dureeEnMinutes([{ distanceMetres: 15000, vitesseRouteKmh: 30 }], 45)).toBeCloseTo(30)
    expect(dureeEnMinutes([{ distanceMetres: 15000, vitesseRouteKmh: 80 }], 45)).toBeCloseTo(20)
    expect(
      dureeEnMinutes(
        [
          { distanceMetres: 15000, vitesseRouteKmh: 30 },
          { distanceMetres: 15000, vitesseRouteKmh: 80 },
        ],
        45,
      ),
    ).toBeCloseTo(50)
  })

  it('une route sans vitesse connue compte à la vitesse habituelle', () => {
    expect(dureeEnMinutes([{ distanceMetres: 15000, vitesseRouteKmh: null }], 45)).toBeCloseTo(20)
    expect(dureeEnMinutes([{ distanceMetres: 15000, vitesseRouteKmh: 0 }], 30)).toBeCloseTo(30)
  })

  it('Critère 3 : à 40 km/h, la durée s’allonge ; une route à 30 km/h reste à 30', () => {
    expect(dureeEnMinutes([{ distanceMetres: 20000, vitesseRouteKmh: 80 }], 40)).toBeCloseTo(30)
    expect(dureeEnMinutes([{ distanceMetres: 15000, vitesseRouteKmh: 30 }], 40)).toBeCloseTo(30)
  })

  it('écrit la durée en toutes lettres', () => {
    expect(formaterDuree(20)).toBe('20 min')
    expect(formaterDuree(85)).toBe('1 h 25 min')
    expect(formaterDuree(120)).toBe('2 h')
    expect(formaterDuree(0.2)).toBe('1 min')
  })

  it('Story #5 : écrit l’écart de temps avec le trajet le plus court', () => {
    expect(formaterEcartDeDuree(42, 30)).toBe('12 min de plus')
    expect(formaterEcartDeDuree(95, 30)).toBe('1 h 5 min de plus')
    expect(formaterEcartDeDuree(27, 30)).toBe('3 min de moins')
    expect(formaterEcartDeDuree(30.2, 29.9)).toBe('même durée')
  })

  it('Critère 2 : départ 8 h 00 et trajet de 20 min, arrivée à 8 h 20', () => {
    const maintenant = new Date(2026, 10, 18, 7, 12)
    const depart = dateDeDepart('08:00', maintenant)
    expect(formaterHeure(heureDArrivee(depart, 20), depart)).toBe('8 h 20')
  })

  it('part de maintenant sans heure choisie, et signale une arrivée le lendemain', () => {
    const maintenant = new Date(2026, 10, 18, 23, 50)
    expect(dateDeDepart('', maintenant)).toBe(maintenant)
    expect(formaterHeure(heureDArrivee(maintenant, 25), maintenant)).toBe('0 h 15 le lendemain')
  })

  it('n’accepte qu’une vitesse entre 10 et 45 km/h', () => {
    expect(vitesseValide('40')).toBe(40)
    expect(vitesseValide('37,5')).toBe(37.5)
    expect(vitesseValide('10')).toBe(10)
    expect(vitesseValide('45')).toBe(45)
    expect(vitesseValide('9')).toBeNull()
    expect(vitesseValide('50')).toBeNull()
    expect(vitesseValide('')).toBeNull()
    expect(vitesseValide('vite')).toBeNull()
  })
})
