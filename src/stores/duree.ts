import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'
import { VITESSE_MAXIMALE_KMH, dateDeDepart, dureeEnMinutes, heureDArrivee } from '@/services/duree'
import { useItineraireStore } from '@/stores/itineraire'

/**
 * Durée du trajet et heure d'arrivée estimée, recalculées sur l'appareil (sans réseau) dès que la
 * vitesse habituelle ou l'heure de départ change. La vitesse est gardée sur l'appareil ; l'heure de
 * départ ne vaut que pour ce trajet (vide : « maintenant »). Partagé par le guidage et la comparaison à venir.
 */
export const useDureeStore = defineStore('duree', () => {
  const magasinItineraire = useItineraireStore()
  const vitesseHabituelle = ref<number>(lire<number>('vitesse-habituelle', VITESSE_MAXIMALE_KMH))
  const heureDepart = ref('')
  const erreur = ref<string | null>(null)

  const dureeMinutes = computed(() =>
    magasinItineraire.resultat
      ? dureeEnMinutes(magasinItineraire.resultat.itineraire.troncons, vitesseHabituelle.value)
      : null,
  )

  function choisirVitesse(nouvelleVitesse: number): void {
    vitesseHabituelle.value = nouvelleVitesse
    erreur.value = ecrire('vitesse-habituelle', nouvelleVitesse)
      ? null
      : 'L’appareil n’a pas pu enregistrer votre vitesse : son stockage est plein ou désactivé.'
  }

  function choisirHeureDepart(heureSaisie: string): void {
    heureDepart.value = heureSaisie
  }

  /** Départ et arrivée estimés ; `maintenant` sert quand aucune heure de départ n'est choisie. */
  function horaires(maintenant: Date): { depart: Date; arrivee: Date } | null {
    if (dureeMinutes.value === null) return null
    const depart = dateDeDepart(heureDepart.value, maintenant)
    return { depart, arrivee: heureDArrivee(depart, dureeMinutes.value) }
  }

  return { vitesseHabituelle, heureDepart, erreur, dureeMinutes, choisirVitesse, choisirHeureDepart, horaires }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useDureeStore, import.meta.hot))
