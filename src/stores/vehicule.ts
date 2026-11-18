import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'

export type EnergieVehicule = 'thermique' | 'electrique'

export const AUTONOMIE_MINIMALE_KM = 1
export const AUTONOMIE_MAXIMALE_KM = 999

export const MESSAGE_AUTONOMIE_INVALIDE = `Indiquez un nombre entier de kilomètres entre ${AUTONOMIE_MINIMALE_KM} et ${AUTONOMIE_MAXIMALE_KM}, par exemple 75.`
export const MESSAGE_STOCKAGE_VEHICULE_PLEIN =
  'L’appareil n’a pas pu enregistrer votre véhicule : son stockage est plein ou désactivé.'

/** Autonomie restante saisie (espaces tolérés) : un entier de 1 à 999 km, sinon `null`. */
export function autonomieValide(saisie: string): number | null {
  const chiffres = saisie.replace(/\s/g, '')
  if (!/^\d+$/.test(chiffres)) return null
  const autonomie = Number(chiffres)
  return autonomie >= AUTONOMIE_MINIMALE_KM && autonomie <= AUTONOMIE_MAXIMALE_KM ? autonomie : null
}

const enKilometres = (metres: number) =>
  (metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/**
 * Message d'alerte si l'autonomie restante ne suffit pas pour le trajet, ou seulement pour l'aller
 * (on suppose un retour par le même chemin). `null` : rien à signaler, ou autonomie pas encore donnée.
 */
export function avertissementDAutonomie(
  distanceMetres: number,
  autonomieRestanteKm: number | null,
  energie: EnergieVehicule | null,
): string | null {
  if (autonomieRestanteKm === null) return null
  const distance = enKilometres(distanceMetres)
  const sansRavitaillement = energie === 'thermique' ? 'sans refaire le plein' : 'sans recharge'
  if (distanceMetres / 1000 > autonomieRestanteKm)
    return `Attention : ce trajet fait ${distance} km et il vous reste ${autonomieRestanteKm} km d’autonomie. Vous ne pourrez pas le faire ${sansRavitaillement}.`
  if ((2 * distanceMetres) / 1000 > autonomieRestanteKm)
    return `Attention : vous pourrez faire l’aller (${distance} km), mais pas l’aller-retour ${sansRavitaillement} : il vous reste ${autonomieRestanteKm} km d’autonomie.`
  return null
}

/**
 * Le véhicule de la personne (voiture sans permis). La motorisation est gardée sur l'appareil ;
 * l'autonomie restante (la charge ou le plein change à chaque sortie) est redemandée à chaque
 * ouverture et n'est jamais gardée. Rien n'est envoyé.
 */
export const useVehiculeStore = defineStore('vehicule', () => {
  const energie = ref<EnergieVehicule | null>(lire<EnergieVehicule | null>('vehicule-energie', null))
  const autonomie = ref<number | null>(null)
  const erreur = ref<string | null>(null)

  function choisirEnergie(nouvelleEnergie: EnergieVehicule): void {
    energie.value = nouvelleEnergie
    erreur.value = ecrire('vehicule-energie', nouvelleEnergie) ? null : MESSAGE_STOCKAGE_VEHICULE_PLEIN
  }

  function choisirAutonomie(nouvelleAutonomie: number): void {
    autonomie.value = nouvelleAutonomie
  }

  return { energie, autonomie, erreur, choisirEnergie, choisirAutonomie }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVehiculeStore, import.meta.hot))
