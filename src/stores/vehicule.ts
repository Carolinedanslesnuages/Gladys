import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'

export type EnergieVehicule = 'thermique' | 'electrique'

export const AUTONOMIE_MINIMALE_KM = 1
export const AUTONOMIE_MAXIMALE_KM = 999

export const MESSAGE_AUTONOMIE_INVALIDE = `Indiquez un nombre entier de kilomètres entre ${AUTONOMIE_MINIMALE_KM} et ${AUTONOMIE_MAXIMALE_KM}, par exemple 75.`
export const MESSAGE_STOCKAGE_VEHICULE_PLEIN =
  'L’appareil n’a pas pu enregistrer votre véhicule : son stockage est plein ou désactivé.'

/** Autonomie saisie (espaces tolérés) : un entier de 1 à 999 km, sinon `null`. */
export function autonomieValide(saisie: string): number | null {
  const chiffres = saisie.replace(/\s/g, '')
  if (!/^\d+$/.test(chiffres)) return null
  const autonomie = Number(chiffres)
  return autonomie >= AUTONOMIE_MINIMALE_KM && autonomie <= AUTONOMIE_MAXIMALE_KM ? autonomie : null
}

/**
 * Le véhicule de la personne (voiture sans permis) : motorisation et autonomie, c'est-à-dire la
 * distance qu'elle parcourt avec un plein ou une charge. Gardé sur l'appareil, jamais envoyé.
 */
export const useVehiculeStore = defineStore('vehicule', () => {
  const energie = ref<EnergieVehicule | null>(lire<EnergieVehicule | null>('vehicule-energie', null))
  const autonomie = ref<number | null>(lire<number | null>('vehicule-autonomie', null))
  const erreur = ref<string | null>(null)

  function enregistrer(cle: string, valeur: EnergieVehicule | number): void {
    erreur.value = ecrire(cle, valeur) ? null : MESSAGE_STOCKAGE_VEHICULE_PLEIN
  }

  function choisirEnergie(nouvelleEnergie: EnergieVehicule): void {
    energie.value = nouvelleEnergie
    enregistrer('vehicule-energie', nouvelleEnergie)
  }

  function choisirAutonomie(nouvelleAutonomie: number): void {
    autonomie.value = nouvelleAutonomie
    enregistrer('vehicule-autonomie', nouvelleAutonomie)
  }

  return { energie, autonomie, erreur, choisirEnergie, choisirAutonomie }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVehiculeStore, import.meta.hot))
