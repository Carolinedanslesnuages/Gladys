import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'
import type { Lieu } from '@/services/adresses'
import type { Calculateur, ResultatItineraire } from '@/services/itineraire'

/**
 * Un trajet favori : tout ce qu'il faut pour le rouvrir sans réseau (lieux, tracé, étapes, durée),
 * sous le nom que la personne lui a donné (ex. : « Maison → Marché »).
 */
export interface Favori {
  id: string
  nom: string
  depart: Lieu
  arrivee: Lieu
  calculateur: Calculateur | null
  resultat: ResultatItineraire
  enregistreLe: string
}

/** Réponse de la personne à « Garder mes trajets favoris sur ce téléphone ? » (`null` : pas encore demandé). */
export type AccordFavoris = 'accepte' | 'refuse' | null

export const LONGUEUR_MAXIMALE_DU_NOM = 60

export const MESSAGE_NOM_VIDE = 'Donnez un nom à ce trajet, par exemple « Maison → Marché ».'
export const MESSAGE_NOM_TROP_LONG = `Ce nom est trop long : ${LONGUEUR_MAXIMALE_DU_NOM} caractères au plus.`
export const MESSAGE_SANS_ACCORD = 'Sans votre accord, aucun trajet n’est enregistré sur ce téléphone.'
export const MESSAGE_STOCKAGE_PLEIN =
  'Ce téléphone n’a plus de place : le trajet n’a pas été enregistré. Vos autres favoris sont intacts. Supprimez un favori pour libérer de la place.'

/**
 * Les trajets favoris, gardés sur l'appareil seulement avec l'accord de la personne, distinct de celui
 * de l'historique (ADR 0013). Sans limite de nombre. Ils ne quittent jamais l'appareil.
 */
export const useFavorisStore = defineStore('favoris', () => {
  const accord = ref<AccordFavoris>(lire<AccordFavoris>('accord-favoris', null))
  const favoris = ref<Favori[]>(accord.value === 'accepte' ? lire<Favori[]>('favoris', []) : [])
  const erreur = ref<string | null>(null)

  function choisirAccord(choix: 'accepte' | 'refuse'): void {
    accord.value = choix
    erreur.value = ecrire('accord-favoris', choix) ? null : MESSAGE_STOCKAGE_PLEIN
  }

  /** Enregistre le trajet sous ce nom. Renvoie le message à montrer si ce n'est pas possible, sinon `null`. */
  function enregistrer(
    nom: string,
    depart: Lieu,
    arrivee: Lieu,
    resultat: ResultatItineraire,
    calculateur: Calculateur | null,
  ): string | null {
    if (accord.value !== 'accepte') return MESSAGE_SANS_ACCORD
    const nomPropre = nom.trim()
    if (nomPropre === '') return MESSAGE_NOM_VIDE
    if (nomPropre.length > LONGUEUR_MAXIMALE_DU_NOM) return MESSAGE_NOM_TROP_LONG
    const favorisAvant = favoris.value
    const nouveauFavori: Favori = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      nom: nomPropre,
      depart,
      arrivee,
      calculateur,
      resultat,
      enregistreLe: new Date().toISOString(),
    }
    favoris.value = [nouveauFavori, ...favorisAvant]
    if (!ecrire('favoris', favoris.value)) {
      favoris.value = favorisAvant
      return MESSAGE_STOCKAGE_PLEIN
    }
    erreur.value = null
    return null
  }

  function supprimer(identifiant: string): void {
    const favorisAvant = favoris.value
    favoris.value = favorisAvant.filter((favori) => favori.id !== identifiant)
    if (!ecrire('favoris', favoris.value)) {
      favoris.value = favorisAvant
      erreur.value = 'L’appareil n’a pas pu supprimer ce trajet : son stockage est désactivé.'
      return
    }
    erreur.value = null
  }

  return { accord, favoris, erreur, choisirAccord, enregistrer, supprimer }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useFavorisStore, import.meta.hot))
