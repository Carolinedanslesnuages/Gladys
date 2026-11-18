import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'

export type EnergieVehicule = 'thermique' | 'electrique'

export const KILOMETRAGE_MAXIMAL = 999999

export const MESSAGE_KILOMETRAGE_INVALIDE = `Indiquez un nombre entier de kilomètres entre 0 et ${KILOMETRAGE_MAXIMAL}, par exemple 12500.`
export const MESSAGE_STOCKAGE_VEHICULE_PLEIN =
  'L’appareil n’a pas pu enregistrer votre véhicule : son stockage est plein ou désactivé.'

/** Kilométrage saisi (espaces tolérés) : un entier de 0 à 999 999, sinon `null`. */
export function kilometrageValide(saisie: string): number | null {
  const chiffres = saisie.replace(/\s/g, '')
  if (!/^\d+$/.test(chiffres)) return null
  const kilometrage = Number(chiffres)
  return kilometrage <= KILOMETRAGE_MAXIMAL ? kilometrage : null
}

/** Le véhicule de la personne (motorisation et kilométrage), gardé sur l'appareil, jamais envoyé. */
export const useVehiculeStore = defineStore('vehicule', () => {
  const energie = ref<EnergieVehicule | null>(lire<EnergieVehicule | null>('vehicule-energie', null))
  const kilometrage = ref<number | null>(lire<number | null>('vehicule-kilometrage', null))
  const erreur = ref<string | null>(null)

  function enregistrer(cle: string, valeur: EnergieVehicule | number): void {
    erreur.value = ecrire(cle, valeur) ? null : MESSAGE_STOCKAGE_VEHICULE_PLEIN
  }

  function choisirEnergie(nouvelleEnergie: EnergieVehicule): void {
    energie.value = nouvelleEnergie
    enregistrer('vehicule-energie', nouvelleEnergie)
  }

  function choisirKilometrage(nouveauKilometrage: number): void {
    kilometrage.value = nouveauKilometrage
    enregistrer('vehicule-kilometrage', nouveauKilometrage)
  }

  return { energie, kilometrage, erreur, choisirEnergie, choisirKilometrage }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVehiculeStore, import.meta.hot))
