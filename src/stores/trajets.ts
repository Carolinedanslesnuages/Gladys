import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'
import type { Lieu } from '@/services/adresses'

/** Un trajet préparé : départ, arrivée et moment où il a été validé. */
export interface Trajet {
  depart: Lieu
  arrivee: Lieu
  valideLe: string
}

/** Réponse de la personne à « Garder mes 5 derniers trajets sur ce téléphone ? » (`null` : pas encore demandé). */
export type AccordHistorique = 'accepte' | 'refuse' | null

export const NOMBRE_DE_TRAJETS_GARDES = 5

/**
 * Les trajets récents, gardés sur l'appareil seulement avec l'accord de la personne (ADR 0002).
 * Ils ne quittent jamais l'appareil et restent utilisables sans réseau.
 */
export const useTrajetsStore = defineStore('trajets', () => {
  const accord = ref<AccordHistorique>(lire<AccordHistorique>('accord-historique', null))
  const trajetsRecents = ref<Trajet[]>(accord.value === 'accepte' ? lire<Trajet[]>('trajets-recents', []) : [])
  const erreur = ref<string | null>(null)

  function signalerSiEchec(enregistre: boolean): void {
    erreur.value = enregistre ? null : 'L’appareil n’a pas pu enregistrer : son stockage est plein ou désactivé.'
  }

  function enregistrerTrajets(): void {
    signalerSiEchec(ecrire('trajets-recents', trajetsRecents.value))
  }

  function choisirAccord(choix: 'accepte' | 'refuse'): void {
    accord.value = choix
    signalerSiEchec(ecrire('accord-historique', choix))
    if (choix === 'refuse') effacerTrajets()
  }

  /** Garde le trajet en tête de liste (sans doublon, 5 au plus) ; ne fait rien sans l'accord de la personne. */
  function retenirTrajet(depart: Lieu, arrivee: Lieu): void {
    if (accord.value !== 'accepte') return
    const autresTrajets = trajetsRecents.value.filter(
      (trajet) => trajet.depart.libelle !== depart.libelle || trajet.arrivee.libelle !== arrivee.libelle,
    )
    trajetsRecents.value = [{ depart, arrivee, valideLe: new Date().toISOString() }, ...autresTrajets].slice(
      0,
      NOMBRE_DE_TRAJETS_GARDES,
    )
    enregistrerTrajets()
  }

  function effacerTrajets(): void {
    trajetsRecents.value = []
    enregistrerTrajets()
  }

  return { accord, trajetsRecents, erreur, choisirAccord, retenirTrajet, effacerTrajets }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTrajetsStore, import.meta.hot))
