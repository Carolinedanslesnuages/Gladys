import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'
import { calculerItineraire, type Calculateur, type ResultatItineraire } from '@/services/itineraire'
import { calculerItineraireOpenStreetMap } from '@/services/openstreetmap'
import type { Lieu } from '@/services/adresses'

export const SEUILS_DE_DETOUR = [10, 20, 30, 50] as const
export const SEUIL_PAR_DEFAUT = 30
export const CALCULATEUR_PAR_DEFAUT: Calculateur = 'ign'

const ECHEC_ENREGISTREMENT = 'L’appareil n’a pas pu enregistrer votre choix : son stockage est plein ou désactivé.'

/**
 * L'itinéraire calculé, le détour maximum et le calculateur choisis par la personne (gardés sur
 * l'appareil). Partagé par les écrans à venir (comparaison, hors connexion, guidage).
 */
export const useItineraireStore = defineStore('itineraire', () => {
  const seuilDetour = ref<number>(lire<number>('seuil-detour', SEUIL_PAR_DEFAUT))
  const calculateur = ref<Calculateur>(lire<Calculateur>('calculateur', CALCULATEUR_PAR_DEFAUT))
  /** Le calculateur qui a produit le résultat affiché. */
  const calculateurDuResultat = ref<Calculateur | null>(null)
  const resultat = ref<ResultatItineraire | null>(null)
  const calculEnCours = ref(false)
  const erreur = ref<string | null>(null)

  function choisirSeuil(nouveauSeuil: number): void {
    seuilDetour.value = nouveauSeuil
    erreur.value = ecrire('seuil-detour', nouveauSeuil) ? null : ECHEC_ENREGISTREMENT
  }

  function choisirCalculateur(nouveauCalculateur: Calculateur): void {
    calculateur.value = nouveauCalculateur
    erreur.value = ecrire('calculateur', nouveauCalculateur) ? null : ECHEC_ENREGISTREMENT
  }

  async function calculer(depart: Lieu, arrivee: Lieu): Promise<void> {
    calculEnCours.value = true
    erreur.value = null
    resultat.value = null
    const calculateurChoisi = calculateur.value
    const calculerAvec = calculateurChoisi === 'openstreetmap' ? calculerItineraireOpenStreetMap : calculerItineraire
    try {
      resultat.value = await calculerAvec(depart, arrivee, seuilDetour.value)
      calculateurDuResultat.value = calculateurChoisi
    } catch {
      erreur.value = 'Le calcul d’itinéraire a besoin du réseau et le service ne répond pas. Réessayez plus tard.'
    } finally {
      calculEnCours.value = false
    }
  }

  /** Remet un itinéraire déjà calculé (un trajet favori) : aucun réseau nécessaire. */
  function restaurer(resultatEnregistre: ResultatItineraire, calculateurEnregistre: Calculateur | null): void {
    resultat.value = resultatEnregistre
    calculateurDuResultat.value = calculateurEnregistre
    calculEnCours.value = false
    erreur.value = null
  }

  function oublier(): void {
    resultat.value = null
    erreur.value = null
  }

  return {
    seuilDetour,
    calculateur,
    calculateurDuResultat,
    resultat,
    calculEnCours,
    erreur,
    choisirSeuil,
    choisirCalculateur,
    calculer,
    restaurer,
    oublier,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useItineraireStore, import.meta.hot))
