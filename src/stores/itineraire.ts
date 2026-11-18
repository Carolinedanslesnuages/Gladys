import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'
import { calculerItineraire, type ResultatItineraire } from '@/services/itineraire'
import type { Lieu } from '@/services/adresses'

export const SEUILS_DE_DETOUR = [10, 20, 30, 50] as const
export const SEUIL_PAR_DEFAUT = 30

/**
 * L'itinéraire calculé et le détour maximum choisi par la personne (gardé sur l'appareil).
 * Partagé par les écrans à venir (comparaison, hors connexion, guidage).
 */
export const useItineraireStore = defineStore('itineraire', () => {
  const seuilDetour = ref<number>(lire<number>('seuil-detour', SEUIL_PAR_DEFAUT))
  const resultat = ref<ResultatItineraire | null>(null)
  const calculEnCours = ref(false)
  const erreur = ref<string | null>(null)

  function choisirSeuil(nouveauSeuil: number): void {
    seuilDetour.value = nouveauSeuil
    erreur.value = ecrire('seuil-detour', nouveauSeuil)
      ? null
      : 'L’appareil n’a pas pu enregistrer votre choix : son stockage est plein ou désactivé.'
  }

  async function calculer(depart: Lieu, arrivee: Lieu): Promise<void> {
    calculEnCours.value = true
    erreur.value = null
    resultat.value = null
    try {
      resultat.value = await calculerItineraire(depart, arrivee, seuilDetour.value)
    } catch {
      erreur.value = 'Le calcul d’itinéraire a besoin du réseau et le service ne répond pas. Réessayez plus tard.'
    } finally {
      calculEnCours.value = false
    }
  }

  function oublier(): void {
    resultat.value = null
    erreur.value = null
  }

  return { seuilDetour, resultat, calculEnCours, erreur, choisirSeuil, calculer, oublier }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useItineraireStore, import.meta.hot))
