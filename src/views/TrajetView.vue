<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ChampLieu from '@/components/ChampLieu.vue'
import CarteTrajet from '@/components/CarteTrajet.vue'
import MenuAPropos from '@/components/MenuAPropos.vue'
import Alerte from '@/components/interface/Alerte.vue'
import Bouton from '@/components/interface/Bouton.vue'
import ChampSaisie from '@/components/interface/ChampSaisie.vue'
import GroupeRadios from '@/components/interface/GroupeRadios.vue'
import Pastille from '@/components/interface/Pastille.vue'
import { ErreurReseau, lieuLePlusProche, type Lieu } from '@/services/adresses'
import { PositionRefusee, positionActuelle } from '@/services/position'
import { NOMBRE_DE_TRAJETS_GARDES, useTrajetsStore, type Trajet } from '@/stores/trajets'
import { SEUILS_DE_DETOUR, useItineraireStore } from '@/stores/itineraire'
import { LONGUEUR_MAXIMALE_DU_NOM, useFavorisStore, type Favori } from '@/stores/favoris'
import { useDureeStore } from '@/stores/duree'
import {
  VITESSE_MAXIMALE_KMH,
  VITESSE_MINIMALE_KMH,
  formaterDuree,
  formaterEcartDeDuree,
  formaterHeure,
  vitesseValide,
} from '@/services/duree'

const magasinTrajets = useTrajetsStore()
const { accord, trajetsRecents, erreur: erreurEnregistrement } = storeToRefs(magasinTrajets)

const magasinItineraire = useItineraireStore()
const {
  seuilDetour,
  calculateur,
  calculateurDuResultat,
  resultat,
  calculEnCours,
  erreur: erreurItineraire,
} = storeToRefs(magasinItineraire)
const optionsDeCalculateur = [
  { label: 'IGN', value: 'ign', hint: 'Le service public des cartes de France.' },
  {
    label: 'OpenStreetMap (en essai)',
    value: 'openstreetmap',
    hint: 'La carte libre et collaborative. Il sait mieux éviter les seuls grands axes. Plus lent : jusqu’à une minute. Trajets de 200 km au plus.',
  },
]
const optionsDeDetour = SEUILS_DE_DETOUR.map((seuil) => ({
  label: `${seuil} % de distance en plus au maximum`,
  value: seuil,
}))

const depart = ref<Lieu | null>(null)
const arrivee = ref<Lieu | null>(null)
const erreurDepart = ref('')
const erreurArrivee = ref('')
const positionEnCours = ref(false)
const annonce = ref('')
const trajetEnAttenteDAccord = ref<{ depart: Lieu; arrivee: Lieu } | null>(null)
const confirmationEffacement = ref(false)
const titreQuestionAccord = ref<HTMLElement | null>(null)
const questionEffacement = ref<HTMLElement | null>(null)
const titreTrajetsRecents = ref<HTMLElement | null>(null)
const titreItineraire = ref<HTMLElement | null>(null)

// Accueil comme une application de navigation (docs/adr/0010-accueil-carte-plein-ecran.md) :
// la carte remplit l'écran sous l'en-tête, la barre « Où allez-vous ? » est posée dessus.
const ecranCarte = ref<HTMLElement | null>(null)
const barreDestination = ref<HTMLFormElement | null>(null)
/** Le départ est la position actuelle, tant que la personne n'en choisit pas un autre. */
const departDepuisMaPosition = ref(true)
/** Barre touchée (focus dedans) : les trajets récents s'affichent dessous. */
const barreOuverte = ref(false)
const AUCUN_TRACE: never[] = []
const traceSurLaCarte = computed(() => resultat.value?.itineraire.trace ?? AUCUN_TRACE)

/** Hauteur de la carte : tout l'écran, moins ce qui est au-dessus (en-tête, bandeaux). */
function ajusterLaHauteurDeLaCarte(): void {
  if (!ecranCarte.value) return
  const hautDeLaCarte = ecranCarte.value.getBoundingClientRect().top + window.scrollY
  ecranCarte.value.style.setProperty('--haut-ecran-carte', `${Math.max(0, hautDeLaCarte)}px`)
}

function fermerLaBarreSiLeFocusSort(evenement: FocusEvent): void {
  if (!barreDestination.value?.contains(evenement.relatedTarget as Node | null))
    barreOuverte.value = false
}
const ouvrirLaBarre = () => (barreOuverte.value = true)
/** Échap referme ce qui s'est ouvert sous la barre (RGAA 10.13). */
const fermerLaBarreAvecEchap = (evenement: KeyboardEvent) => {
  if (evenement.key === 'Escape') barreOuverte.value = false
}
// Écoutés sur la barre entière : le focus et les touches viennent de ses champs et boutons.
onMounted(() => {
  barreDestination.value?.addEventListener('focusin', ouvrirLaBarre)
  barreDestination.value?.addEventListener('focusout', fermerLaBarreSiLeFocusSort)
  barreDestination.value?.addEventListener('keydown', fermerLaBarreAvecEchap)
})

// Réseau : la recherche d'adresse et la position en ont besoin, pas les trajets récents.
const enLigne = ref(navigator.onLine)
const suivreLeReseau = () => (enLigne.value = navigator.onLine)
onMounted(() => {
  window.addEventListener('online', suivreLeReseau)
  window.addEventListener('offline', suivreLeReseau)
  window.addEventListener('resize', ajusterLaHauteurDeLaCarte)
  ajusterLaHauteurDeLaCarte()
})
onUnmounted(() => {
  window.removeEventListener('online', suivreLeReseau)
  window.removeEventListener('offline', suivreLeReseau)
  window.removeEventListener('resize', ajusterLaHauteurDeLaCarte)
})

// Trajets favoris : enregistrés avec leur itinéraire, ils se rouvrent sans réseau (ADR 0013).
const magasinFavoris = useFavorisStore()
const { accord: accordFavoris, favoris, erreur: erreurFavoris } = storeToRefs(magasinFavoris)
/** Vrai pendant l'ouverture d'un favori : son itinéraire est déjà là, il ne faut ni l'oublier ni le recalculer. */
const ouvertureDeFavoriEnCours = ref(false)
/** Vrai tant que l'itinéraire affiché vient d'un favori : la carte reste affichée sans réseau. */
const favoriOuvert = ref(false)
const enregistrementOuvert = ref(false)
const nomDuFavori = ref('')
const erreurNomDuFavori = ref('')
const favoriASupprimer = ref<Favori | null>(null)
const titreEnregistrement = ref<HTMLElement | null>(null)
const titreFavoris = ref<HTMLElement | null>(null)

// Un itinéraire calculé ne vaut que pour le départ et l'arrivée qui l'ont produit.
watch([depart, arrivee], () => {
  if (ouvertureDeFavoriEnCours.value) return
  favoriOuvert.value = false
  magasinItineraire.oublier()
})

// Comme une application de navigation : le trajet se calcule dès que la destination est choisie
// (ou le départ, s'il n'est pas « Ma position »), sans bouton à toucher.
watch([arrivee, depart], ([nouvelleArrivee, nouveauDepart], [ancienneArrivee]) => {
  if (ouvertureDeFavoriEnCours.value) return
  if (!nouvelleArrivee || positionEnCours.value) return
  const destinationChoisie = nouvelleArrivee !== ancienneArrivee
  if (departDepuisMaPosition.value ? destinationChoisie : nouveauDepart) void validerTrajet()
})

const enKilometres = (metres: number) =>
  `${(metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`

const annonceItineraire = computed(() => {
  if (calculEnCours.value) return 'Calcul de votre itinéraire…'
  if (!resultat.value) return ''
  const { itineraire } = resultat.value
  const departementale =
    itineraire.departementaleFortTraficMetres > 0
      ? `dont ${enKilometres(itineraire.departementaleFortTraficMetres)} sur route à fort trafic`
      : 'sans route à fort trafic'
  return `Itinéraire calculé : ${enKilometres(itineraire.distanceMetres)}, sans autoroute ni voie rapide, ${departementale}.`
})

// Durée et heure d'arrivée : recalculées sur l'appareil, même sans réseau.
const magasinDuree = useDureeStore()
const {
  vitesseHabituelle,
  heureDepart,
  dureeMinutes,
  dureePlusCourtMinutes,
  erreur: erreurDuree,
} = storeToRefs(magasinDuree)
const vitesseSaisie = ref(String(vitesseHabituelle.value))
const erreurVitesse = ref('')
const heureMaintenant = () => {
  const maintenant = new Date()
  return `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`
}

// Une fois l'itinéraire calculé, la barre se replie en une ligne : la carte reste dégagée.
const barreDeplieeALaMain = ref(false)
const barreRepliee = computed(
  () => Boolean(resultat.value && arrivee.value) && !barreDeplieeALaMain.value,
)
async function deplierLaBarre(): Promise<void> {
  barreDeplieeALaMain.value = true
  await nextTick()
  document.getElementById('arrivee')?.focus()
}

// Un nouvel itinéraire part « maintenant » par défaut.
watch(resultat, (nouveauResultat) => {
  if (nouveauResultat) {
    magasinDuree.choisirHeureDepart(heureMaintenant())
    barreDeplieeALaMain.value = false
  }
})

function saisirVitesse(valeur: string | number | undefined): void {
  vitesseSaisie.value = String(valeur ?? '')
  const vitesse = vitesseValide(vitesseSaisie.value)
  if (vitesse === null) {
    erreurVitesse.value = `Indiquez une vitesse entre ${VITESSE_MINIMALE_KMH} et ${VITESSE_MAXIMALE_KMH} km/h, par exemple 40.`
    return
  }
  erreurVitesse.value = ''
  magasinDuree.choisirVitesse(vitesse)
}

const horairesEstimes = computed(() => {
  const horaires = magasinDuree.horaires(new Date())
  if (!horaires || dureeMinutes.value === null) return null
  return {
    duree: formaterDuree(dureeMinutes.value),
    arrivee: formaterHeure(horaires.arrivee, horaires.depart),
  }
})

const annonceDuree = computed(() =>
  horairesEstimes.value
    ? `Durée estimée : ${horairesEstimes.value.duree}, arrivée vers ${horairesEstimes.value.arrivee}.`
    : '',
)

// Comparaison avec le trajet le plus court, à la même vitesse de VSP.
const ecartDeDistance = (metresRetenu: number, metresPlusCourt: number) => {
  const ecartMetres = metresRetenu - metresPlusCourt
  if (Math.abs(ecartMetres) < 50) return 'même distance'
  return `${enKilometres(Math.abs(ecartMetres))} de ${ecartMetres > 0 ? 'plus' : 'moins'}`
}

const comparaison = computed(() => {
  if (!resultat.value || dureeMinutes.value === null || dureePlusCourtMinutes.value === null)
    return null
  if (resultat.value.retenuEstLePlusCourt) {
    return {
      dejaLePlusCourt: true,
      annonce: 'Votre trajet est déjà le trajet le plus court sans autoroute.',
    }
  }
  const plusCourt = {
    distance: enKilometres(resultat.value.plusCourt.distanceMetres),
    duree: formaterDuree(dureePlusCourtMinutes.value),
  }
  const ecart = `${formaterEcartDeDuree(dureeMinutes.value, dureePlusCourtMinutes.value)}, ${ecartDeDistance(
    resultat.value.itineraire.distanceMetres,
    resultat.value.plusCourt.distanceMetres,
  )}`
  return {
    dejaLePlusCourt: false,
    plusCourt,
    ecart,
    annonce: `Trajet le plus court : ${plusCourt.distance}, ${plusCourt.duree}. Votre trajet : ${ecart}.`,
  }
})

async function calculerMonItineraire(): Promise<void> {
  if (!depart.value || !arrivee.value || !enLigne.value) return
  await magasinItineraire.calculer(depart.value, arrivee.value)
}

const descriptionTrajet = (lieuDepart: Lieu, lieuArrivee: Lieu) =>
  `de ${lieuDepart.libelle} à ${lieuArrivee.libelle}`

/** « Ma position » : revenir au départ par défaut, la position actuelle. */
async function utiliserMaPosition(): Promise<void> {
  departDepuisMaPosition.value = true
  depart.value = null
  erreurDepart.value = ''
  annonce.value = 'Départ : votre position actuelle.'
  await nextTick()
  document.getElementById('bouton-depart-ma-position')?.focus()
  if (arrivee.value) await validerTrajet()
}

/** Toucher « Ma position » ouvre le champ « Départ » pour en choisir un autre. */
async function changerDeDepart(): Promise<void> {
  departDepuisMaPosition.value = false
  await nextTick()
  document.getElementById('depart')?.focus()
}

/** Cherche l'adresse de la position actuelle ; en cas d'échec, le champ « Départ » s'ouvre avec l'explication. */
async function trouverMonDepart(): Promise<void> {
  erreurDepart.value = ''
  positionEnCours.value = true
  annonce.value = 'Recherche de votre position…'
  try {
    const coordonnees = await positionActuelle()
    const lieuProche = await lieuLePlusProche(coordonnees.latitude, coordonnees.longitude)
    if (lieuProche) {
      depart.value = lieuProche
      annonce.value = `Départ rempli avec votre position actuelle : ${lieuProche.libelle}.`
    } else {
      annonce.value = ''
      erreurDepart.value = 'Aucune adresse connue près de votre position. Saisissez votre départ.'
    }
  } catch (erreur) {
    annonce.value = ''
    if (erreur instanceof PositionRefusee) {
      erreurDepart.value =
        'Position refusée : autorisez la localisation pour GLADYS dans les réglages du téléphone, ou saisissez votre départ.'
    } else if (erreur instanceof ErreurReseau) {
      erreurDepart.value =
        'Trouver l’adresse de votre position a besoin du réseau. Saisissez votre départ plus tard.'
    } else {
      erreurDepart.value =
        'Votre position est introuvable pour le moment. Réessayez, ou saisissez votre départ.'
    }
  } finally {
    positionEnCours.value = false
  }
  if (erreurDepart.value) departDepuisMaPosition.value = false
}

async function validerTrajet(): Promise<void> {
  erreurArrivee.value = arrivee.value
    ? ''
    : 'Choisissez votre arrivée dans la liste des propositions.'
  if (!arrivee.value) {
    document.getElementById('arrivee')?.focus()
    return
  }
  if (departDepuisMaPosition.value) await trouverMonDepart()
  else
    erreurDepart.value = depart.value
      ? ''
      : 'Choisissez votre départ dans la liste des propositions.'
  if (!depart.value) {
    await nextTick()
    document.getElementById('depart')?.focus()
    return
  }
  barreOuverte.value = false
  annonce.value = `Trajet prêt : ${descriptionTrajet(depart.value, arrivee.value)}.`
  if (accord.value === null) {
    trajetEnAttenteDAccord.value = { depart: depart.value, arrivee: arrivee.value }
    await nextTick()
    titreQuestionAccord.value?.focus()
  } else {
    magasinTrajets.retenirTrajet(depart.value, arrivee.value)
  }
  // Le calcul part tout de suite : durée et distance s'affichent sur la carte, le détail dessous.
  await calculerMonItineraire()
}

/** Revenir sur la carte, en haut de l'écran, depuis le détail du trajet. */
const voirLaCarte = () => document.getElementById('carte-trajet')?.focus()
// Sous la carte, rien ne s'affiche tant que la personne ne le demande pas : la carte reste seule.
const detailAffiche = ref(false)
const basculerLeDetail = () => (detailAffiche.value = !detailAffiche.value)
/** Depuis le résumé posé sur la carte, afficher le détail du trajet et y descendre. */
async function voirLeDetailDuTrajet(): Promise<void> {
  detailAffiche.value = true
  await nextTick()
  titreItineraire.value?.focus()
}

async function repondreAccord(choix: 'accepte' | 'refuse'): Promise<void> {
  magasinTrajets.choisirAccord(choix)
  if (choix === 'accepte' && trajetEnAttenteDAccord.value) {
    magasinTrajets.retenirTrajet(
      trajetEnAttenteDAccord.value.depart,
      trajetEnAttenteDAccord.value.arrivee,
    )
  }
  trajetEnAttenteDAccord.value = null
  annonce.value =
    choix === 'accepte'
      ? 'Vos 5 derniers trajets seront gardés sur ce téléphone.'
      : 'Vos trajets ne seront pas gardés sur ce téléphone.'
  // La réponse se lit dans « Mes trajets récents » : on les affiche pour y amener le focus.
  detailAffiche.value = true
  await nextTick()
  titreTrajetsRecents.value?.focus()
}

/** « Enregistrer ce trajet » : demande l'accord (une fois), puis le nom. */
async function ouvrirEnregistrement(): Promise<void> {
  enregistrementOuvert.value = true
  erreurNomDuFavori.value = ''
  detailAffiche.value = true
  await nextTick()
  titreEnregistrement.value?.focus()
}

async function repondreAccordFavoris(choix: 'accepte' | 'refuse'): Promise<void> {
  magasinFavoris.choisirAccord(choix)
  if (choix === 'refuse') {
    enregistrementOuvert.value = false
    annonce.value = 'Aucun trajet ne sera enregistré sur ce téléphone.'
    return
  }
  annonce.value = 'Vos trajets favoris seront gardés sur ce téléphone.'
  await nextTick()
  document.getElementById('nom-du-favori')?.focus()
}

async function enregistrerLeTrajet(): Promise<void> {
  if (!depart.value || !arrivee.value || !resultat.value) return
  const nomEnregistre = nomDuFavori.value.trim()
  const probleme = magasinFavoris.enregistrer(
    nomDuFavori.value,
    depart.value,
    arrivee.value,
    resultat.value,
    calculateurDuResultat.value,
  )
  erreurNomDuFavori.value = probleme ?? ''
  if (probleme) {
    await nextTick()
    document.getElementById('nom-du-favori')?.focus()
    return
  }
  enregistrementOuvert.value = false
  nomDuFavori.value = ''
  annonce.value = `Trajet « ${nomEnregistre} » enregistré. Il s’ouvrira même sans réseau.`
  await nextTick()
  titreFavoris.value?.focus()
}

function annulerEnregistrement(): void {
  enregistrementOuvert.value = false
  nomDuFavori.value = ''
  erreurNomDuFavori.value = ''
  document.getElementById('bouton-enregistrer-trajet')?.focus()
}

/** Rouvre un favori avec son tracé et ses étapes enregistrés : aucun réseau nécessaire. */
async function ouvrirFavori(favori: Favori): Promise<void> {
  ouvertureDeFavoriEnCours.value = true
  departDepuisMaPosition.value = false
  barreOuverte.value = false
  barreDeplieeALaMain.value = false
  depart.value = favori.depart
  arrivee.value = favori.arrivee
  erreurDepart.value = ''
  erreurArrivee.value = ''
  magasinItineraire.restaurer(favori.resultat, favori.calculateur)
  favoriOuvert.value = true
  // Les observateurs de départ et d'arrivée passent au prochain cycle : le drapeau reste levé jusque-là.
  await nextTick()
  ouvertureDeFavoriEnCours.value = false
  annonce.value = `Trajet favori ouvert : ${favori.nom}, ${descriptionTrajet(favori.depart, favori.arrivee)}.${enLigne.value ? '' : ' Sans réseau, seuls les morceaux de carte déjà vus s’affichent.'}`
  document.getElementById('carte-trajet')?.focus()
}

async function demanderSuppression(favori: Favori): Promise<void> {
  favoriASupprimer.value = favori
  await nextTick()
  document.getElementById('question-suppression')?.focus()
}

async function supprimerLeFavori(confirme: boolean): Promise<void> {
  const favori = favoriASupprimer.value
  favoriASupprimer.value = null
  if (favori && confirme) {
    magasinFavoris.supprimer(favori.id)
    annonce.value = `Trajet « ${favori.nom} » supprimé de ce téléphone.`
  }
  await nextTick()
  titreFavoris.value?.focus()
}

function reprendre(trajet: Trajet): void {
  departDepuisMaPosition.value = false
  barreOuverte.value = false
  depart.value = trajet.depart
  arrivee.value = trajet.arrivee
  erreurDepart.value = ''
  erreurArrivee.value = ''
  annonce.value = `Trajet repris : ${descriptionTrajet(trajet.depart, trajet.arrivee)}.`
}

async function demanderEffacement(): Promise<void> {
  confirmationEffacement.value = true
  await nextTick()
  questionEffacement.value?.focus()
}

async function effacer(confirme: boolean): Promise<void> {
  if (confirme) {
    magasinTrajets.effacerTrajets()
    annonce.value = 'Vos trajets récents sont effacés de ce téléphone.'
  }
  confirmationEffacement.value = false
  await nextTick()
  titreTrajetsRecents.value?.focus()
}
</script>

<template>
  <h1 class="visuellement-cache">Préparer mon trajet</h1>

  <div ref="ecranCarte" class="ecran-carte">
    <!-- Avant la carte dans la page : au clavier, on arrive d'abord sur « Où allez-vous ? ». -->
    <div class="haut-de-carte">
      <form
        id="barre-destination"
        ref="barreDestination"
        role="search"
        aria-label="Où allez-vous ?"
        novalidate
        class="barre-destination"
        @submit.prevent="validerTrajet"
      >
        <Bouton
          v-if="barreRepliee"
          id="bouton-deplier-barre"
          type="button"
          variante="discret"
          icone="recherche"
          class="bouton-barre bouton-deplier-barre"
          :label="`Vers ${arrivee?.libelle}`"
          :aria-label="`Destination : ${arrivee?.libelle}. Modifier le trajet`"
          aria-controls="champs-du-trajet"
          aria-expanded="false"
          @click="deplierLaBarre"
        />
        <div v-show="!barreRepliee" id="champs-du-trajet">
          <ChampLieu
            id="arrivee"
            v-model="arrivee"
            label="Où allez-vous ?"
            indication="Obligatoire. Une adresse ou une commune, puis choisissez dans la liste"
            :en-ligne="enLigne"
            :erreur-externe="erreurArrivee"
          >
            <template #sans-saisie>
              <!-- mousedown sans effet : le focus reste dans la barre pendant qu'on touche un trajet. -->
              <div
                v-if="barreOuverte && accord === 'accepte' && trajetsRecents.length > 0"
                id="trajets-sous-la-barre"
                class="marge-haut-2"
                @mousedown.prevent
              >
                <p id="titre-trajets-sous-la-barre" class="texte-petit texte-gras marge-bas-1">
                  Mes trajets récents
                </p>
                <ul
                  class="sans-remplissage sans-marge trajets-recents"
                  aria-labelledby="titre-trajets-sous-la-barre"
                >
                  <li v-for="trajet in trajetsRecents" :key="trajet.valideLe">
                    <Bouton
                      type="button"
                      variante="discret"
                      icone="horloge"
                      class="trajet-recent-sous-la-barre"
                      :label="`De ${trajet.depart.libelle} à ${trajet.arrivee.libelle}`"
                      :aria-label="`Reprendre le trajet ${descriptionTrajet(trajet.depart, trajet.arrivee)}`"
                      @click="reprendre(trajet)"
                    />
                  </li>
                </ul>
              </div>
            </template>
          </ChampLieu>

          <p v-if="departDepuisMaPosition" class="ligne-depart marge-bas-0">
            <span>Départ :</span>
            <Bouton
              id="bouton-depart-ma-position"
              type="button"
              variante="discret"
              icone="position"
              class="bouton-barre"
              :label="positionEnCours ? 'Recherche de votre position…' : 'Ma position'"
              :aria-label="
                positionEnCours
                  ? 'Recherche de votre position…'
                  : 'Départ : Ma position. Changer le départ'
              "
              :disabled="positionEnCours"
              @click="changerDeDepart"
            />
          </p>
          <template v-else>
            <ChampLieu
              id="depart"
              v-model="depart"
              label="Départ"
              :en-ligne="enLigne"
              :erreur-externe="erreurDepart"
            />
            <Bouton
              type="button"
              variante="discret"
              icone="position"
              class="bouton-barre"
              label="Utiliser ma position actuelle"
              @click="utiliserMaPosition"
            />
          </template>
          <Bouton
            v-if="arrivee && !resultat && !calculEnCours"
            type="submit"
            class="marge-haut-2"
            label="Valider mon trajet"
            icone="valider"
            :disabled="positionEnCours"
          />
          <Alerte
            v-if="!enLigne"
            type="info"
            class="marge-haut-2"
            description="Sans réseau, la recherche d’adresse et la position actuelle sont indisponibles. Vos trajets récents restent utilisables."
          />
        </div>
      </form>
    </div>
    <CarteTrajet
      :trace="traceSurLaCarte"
      :depart="depart"
      :arrivee="arrivee"
      :en-ligne="enLigne"
      :carte-hors-connexion="favoriOuvert"
      suivre-des-l-ouverture
    >
      <!-- Durée et distance sur la carte, sans faire défiler ; les annonces vocales sont plus bas. -->
      <!-- Discret, à droite, à côté de la distance restante : seule la durée se voit (ex. : « 45 min »). -->
      <template #sur-la-carte="{ distanceRestanteAffichee }">
        <div
          v-if="depart && arrivee && (calculEnCours || resultat || erreurItineraire)"
          id="resume-trajet"
          class="panneau-resume"
          :class="{ 'panneau-resume--large': calculEnCours || erreurItineraire }"
        >
          <p v-if="calculEnCours" class="marge-bas-0">Calcul de votre itinéraire…</p>
          <Alerte
            v-else-if="erreurItineraire"
            type="error"
            :description="erreurItineraire"
          />
          <template v-else-if="resultat">
            <p class="texte-grand marge-bas-0">
              <strong>{{ horairesEstimes?.duree ?? '' }}</strong>
              <!-- La distance totale se voit tant que la distance restante n'est pas affichée à côté. -->
              <span v-if="!distanceRestanteAffichee"
                ><template v-if="horairesEstimes"> · </template
                >{{ enKilometres(resultat.itineraire.distanceMetres) }}</span
              >
              <span v-else class="visuellement-cache"
                >, {{ enKilometres(resultat.itineraire.distanceMetres) }} au total</span
              >
              <span v-if="horairesEstimes" class="visuellement-cache"
                >. Arrivée vers {{ horairesEstimes.arrivee }}.</span
              >
            </p>
            <Bouton
              type="button"
              variante="discret"
              icone="flecheBas"
              class="bouton-barre"
              label="Détail"
              aria-label="Voir le détail du trajet"
              @click="voirLeDetailDuTrajet"
            />
          </template>
        </div>
      </template>
    </CarteTrajet>
  </div>

  <div class="conteneur marge-verticale-12">
    <p id="annonce-trajet" role="status" class="visuellement-cache">{{ annonce }}</p>

    <!-- Sous la carte : masqué tant que la personne ne demande pas à le voir. -->
    <Bouton
      id="bouton-afficher-detail"
      type="button"
      variante="secondaire"
      class="marge-bas-6"
      :icone="detailAffiche ? 'replier' : 'deplier'"
      :label="
        detailAffiche
          ? 'Masquer le détail et mes trajets récents'
          : 'Afficher le détail et mes trajets récents'
      "
      :aria-expanded="detailAffiche ? 'true' : 'false'"
      aria-controls="detail-du-trajet mes-trajets-favoris mes-trajets-recents"
      @click="basculerLeDetail"
    />
    <!-- Plus de menu sur la carte : « À propos » (accessibilité, mentions légales, relevés) reste ici. -->
    <div class="marge-bas-6">
      <MenuAPropos />
    </div>
    <div v-show="detailAffiche" id="detail-du-trajet">
      <section v-if="depart && arrivee" class="marge-bas-8" aria-labelledby="titre-itineraire">
        <h2 id="titre-itineraire" ref="titreItineraire" tabindex="-1" class="titre-5">
          Mon itinéraire
        </h2>
        <p>Il ne passe jamais par une autoroute ni une voie rapide.</p>
        <GroupeRadios
          name="seuil-detour"
          legend="Détour accepté pour éviter les routes à fort trafic"
          hint="Les départementales calmes restent permises. Votre choix reste gardé sur ce téléphone."
          :model-value="seuilDetour"
          :options="optionsDeDetour"
          @update:model-value="
            (nouveauSeuil: string | number | boolean | undefined) =>
              magasinItineraire.choisirSeuil(Number(nouveauSeuil))
          "
        />
        <GroupeRadios
          name="calculateur"
          legend="Calculateur d’itinéraire"
          hint="Votre choix reste gardé sur ce téléphone."
          :model-value="calculateur"
          :options="optionsDeCalculateur"
          @update:model-value="
            (nouveauCalculateur: string | number | boolean | undefined) =>
              magasinItineraire.choisirCalculateur(
                nouveauCalculateur === 'openstreetmap' ? 'openstreetmap' : 'ign',
              )
          "
        />
        <p v-if="!enLigne" class="marge-bas-4">
          Le calcul d’itinéraire a besoin du réseau. Il sera possible dès son retour.
        </p>
        <Bouton
          type="button"
          icone="itineraire"
          :label="calculEnCours ? 'Calcul de votre itinéraire…' : 'Calculer mon itinéraire'"
          :disabled="!enLigne || calculEnCours"
          @click="calculerMonItineraire"
        />

        <div id="resultat-itineraire" role="status" class="marge-haut-6">
          <Alerte v-if="erreurItineraire" type="error" :description="erreurItineraire" />
          <template v-if="resultat">
            <Alerte
              v-if="!resultat.sansDepartementalePossible"
              type="warning"
              class="marge-bas-4"
              description="Aucun itinéraire sans route à fort trafic n’existe pour ce trajet. Voici le trajet le plus sûr, avec le moins de fort trafic possible."
            />
            <Alerte
              v-else-if="resultat.detourTropLong"
              type="info"
              class="marge-bas-4"
              :description="`Un trajet sans route à fort trafic existe, mais son détour dépasse ${seuilDetour} %. Voici le trajet le plus court sans autoroute.`"
            />
            <dl class="marge-bas-0">
              <dt>Distance totale</dt>
              <dd>{{ enKilometres(resultat.itineraire.distanceMetres) }}</dd>
              <dt>Sur route à fort trafic</dt>
              <dd v-if="resultat.itineraire.departementaleFortTraficMetres > 0">
                {{ enKilometres(resultat.itineraire.departementaleFortTraficMetres) }}
              </dd>
              <dd v-else>Aucun kilomètre : trajet sans route à fort trafic</dd>
              <dt>Calculé avec</dt>
              <!-- prettier-ignore -->
              <dd v-if="calculateurDuResultat === 'openstreetmap'">OpenStreetMap (© les contributeurs d’OpenStreetMap)</dd>
              <dd v-else>IGN</dd>
            </dl>
          </template>
          <p class="visuellement-cache">{{ annonceItineraire }}</p>
        </div>

        <template v-if="horairesEstimes">
          <h3 class="titre-6 marge-haut-6">Mon temps de trajet</h3>
          <dl id="duree-trajet" class="marge-bas-4 duree-et-arrivee">
            <div>
              <dt>Durée estimée</dt>
              <dd>{{ horairesEstimes.duree }}</dd>
            </div>
            <div>
              <dt>Arrivée estimée</dt>
              <dd>vers {{ horairesEstimes.arrivee }}</dd>
            </div>
          </dl>
          <p id="annonce-duree" role="status" class="visuellement-cache">{{ annonceDuree }}</p>
          <p class="texte-petit">
            Calculée à {{ vitesseHabituelle.toLocaleString('fr-FR') }} km/h au plus, et moins vite
            si la route est plus lente.
          </p>
          <ChampSaisie
            id="vitesse-habituelle"
            :model-value="vitesseSaisie"
            label="Ma vitesse moyenne habituelle, en km/h"
            :indication="`Entre ${VITESSE_MINIMALE_KMH} et ${VITESSE_MAXIMALE_KMH} km/h. Elle reste gardée sur ce téléphone.`"
            :message-erreur="erreurVitesse || erreurDuree || undefined"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            @update:model-value="saisirVitesse"
          />
          <ChampSaisie
            id="heure-depart"
            :model-value="heureDepart"
            label="Mon heure de départ"
            indication="Par défaut : maintenant. Vide : départ maintenant."
            type="time"
            @update:model-value="
              (heureSaisie: string | number | undefined) =>
                magasinDuree.choisirHeureDepart(String(heureSaisie ?? ''))
            "
          />
        </template>

        <template v-if="comparaison">
          <h3 class="titre-6 marge-haut-6">Comparer avec le trajet le plus court</h3>
          <div id="comparaison-trajet" class="marge-bas-4">
            <p v-if="comparaison.dejaLePlusCourt">{{ comparaison.annonce }}</p>
            <dl v-else class="marge-bas-0">
              <dt>Trajet le plus court sans autoroute</dt>
              <dd>{{ comparaison.plusCourt?.distance }}, {{ comparaison.plusCourt?.duree }}</dd>
              <dt>Votre trajet par rapport à lui</dt>
              <dd>{{ comparaison.ecart }}</dd>
            </dl>
          </div>
          <p id="annonce-comparaison" role="status" class="visuellement-cache">{{ comparaison.annonce }}</p>
        </template>

        <template v-if="resultat && resultat.itineraire.trace.length >= 2">
          <h3 class="titre-6 marge-haut-6">Mon trajet sur la carte</h3>
          <p>
            Il est tracé sur la carte, en haut de l’écran. Gardez les yeux sur la route : regardez
            la carte seulement à l’arrêt.
          </p>
          <Bouton
            type="button"
            variante="secondaire"
            icone="itineraire"
            label="Voir mon trajet sur la carte"
            @click="voirLaCarte"
          />
        </template>

        <template v-if="resultat && resultat.itineraire.etapes.length > 0">
          <h3 id="titre-etapes" class="titre-6 marge-haut-6">Les étapes de mon trajet</h3>
          <ol id="etapes-trajet" class="etapes" aria-labelledby="titre-etapes">
            <li v-for="(etape, rang) in resultat.itineraire.etapes" :key="rang" class="marge-bas-2">
              <strong>{{ etape.commune ?? 'Commune non précisée' }}</strong> — {{ etape.route }} —
              {{ enKilometres(etape.distanceMetres) }}
              <Pastille
                v-if="etape.fortTrafic"
                :label="
                  etape.departementale ? 'Départementale à fort trafic' : 'Grand axe à fort trafic'
                "
                type="warning"
                class="marge-gauche-2"
              />
              <Pastille
                v-else-if="etape.departementale"
                label="Départementale calme"
                type="info"
                class="marge-gauche-2"
              />
            </li>
          </ol>
        </template>

        <template v-if="resultat">
          <h3 id="titre-enregistrement" ref="titreEnregistrement" tabindex="-1" class="titre-6 marge-haut-6">
            Garder ce trajet hors connexion
          </h3>
          <Bouton
            v-if="!enregistrementOuvert"
            id="bouton-enregistrer-trajet"
            type="button"
            variante="secondaire"
            icone="enregistrer"
            label="Enregistrer ce trajet"
            @click="ouvrirEnregistrement"
          />
          <div v-else-if="accordFavoris !== 'accepte'" class="remplissage-6 question-accord">
            <p class="texte-gras">Garder mes trajets favoris sur ce téléphone ?</p>
            <p>
              Un favori peut contenir l’adresse de votre domicile. Il reste sur ce téléphone, ne
              part nulle part, et vous le rouvrez même sans réseau. Vous pouvez le supprimer à tout
              moment.
            </p>
            <div class="groupe-boutons">
              <Bouton
                type="button"
                label="Oui, garder mes favoris"
                @click="repondreAccordFavoris('accepte')"
              />
              <Bouton
                type="button"
                variante="secondaire"
                label="Non, ne rien enregistrer"
                @click="repondreAccordFavoris('refuse')"
              />
            </div>
          </div>
          <form v-else id="formulaire-favori" novalidate @submit.prevent="enregistrerLeTrajet">
            <ChampSaisie
              id="nom-du-favori"
              v-model="nomDuFavori"
              label="Nom du trajet (obligatoire)"
              :indication="`Par exemple : Maison → Marché. ${LONGUEUR_MAXIMALE_DU_NOM} caractères au plus.`"
              :message-erreur="erreurNomDuFavori || undefined"
              type="text"
              autocomplete="off"
              required
            />
            <div class="groupe-boutons">
              <Bouton type="submit" label="Enregistrer ce trajet sous ce nom" />
              <Bouton
                type="button"
                variante="secondaire"
                label="Annuler"
                @click="annulerEnregistrement"
              />
            </div>
          </form>
        </template>
      </section>
    </div>
    <Alerte
      v-if="erreurEnregistrement"
      type="error"
      :description="erreurEnregistrement"
      class="marge-bas-4"
    />

    <Alerte
      v-if="erreurFavoris"
      type="error"
      :description="erreurFavoris"
      class="marge-bas-4"
    />

    <div v-show="detailAffiche" id="mes-trajets-favoris" class="marge-bas-8">
      <h2 id="titre-trajets-favoris" ref="titreFavoris" tabindex="-1" class="titre-5">
        Mes trajets favoris
      </h2>
      <p v-if="favoris.length === 0">
        Aucun trajet favori pour l’instant. Préparez un trajet, puis choisissez « Enregistrer ce
        trajet » dans son détail.
      </p>
      <ul v-else class="sans-remplissage trajets-recents" aria-labelledby="titre-trajets-favoris">
        <li v-for="favori in favoris" :key="favori.id" class="marge-bas-4">
          <div v-if="favoriASupprimer?.id === favori.id">
            <p id="question-suppression" tabindex="-1">
              Supprimer le trajet « {{ favori.nom }} » de ce téléphone ?
            </p>
            <div class="groupe-boutons">
              <Bouton
                type="button"
                :label="`Oui, supprimer le trajet ${favori.nom}`"
                @click="supprimerLeFavori(true)"
              />
              <Bouton
                type="button"
                variante="secondaire"
                label="Annuler"
                :aria-label="`Annuler : garder le trajet ${favori.nom}`"
                @click="supprimerLeFavori(false)"
              />
            </div>
          </div>
          <div v-else class="groupe-boutons">
            <Bouton
              type="button"
              variante="discret"
              icone="etoile"
              class="trajet-recent"
              :label="favori.nom"
              :aria-label="`Ouvrir le trajet favori ${favori.nom}`"
              @click="ouvrirFavori(favori)"
            />
            <Bouton
              type="button"
              variante="discret"
              icone="corbeille"
              label="Supprimer"
              :aria-label="`Supprimer le trajet ${favori.nom}`"
              @click="demanderSuppression(favori)"
            />
          </div>
        </li>
      </ul>
    </div>

    <section
      v-if="trajetEnAttenteDAccord"
      class="marge-bas-8 remplissage-6 question-accord"
      aria-labelledby="titre-accord"
    >
      <h2 id="titre-accord" ref="titreQuestionAccord" tabindex="-1" class="titre-5">
        Garder mes {{ NOMBRE_DE_TRAJETS_GARDES }} derniers trajets sur ce téléphone ?
      </h2>
      <p>
        Vous pourrez les reprendre d’un geste, même sans réseau. Ils restent sur ce téléphone et
        vous pouvez les effacer à tout moment.
      </p>
      <div class="groupe-boutons">
        <Bouton
          type="button"
          label="Oui, garder mes trajets"
          @click="repondreAccord('accepte')"
        />
        <Bouton
          type="button"
          variante="secondaire"
          label="Non, ne rien garder"
          @click="repondreAccord('refuse')"
        />
      </div>
    </section>

    <div v-show="detailAffiche" id="mes-trajets-recents">
      <h2 id="titre-trajets-recents" ref="titreTrajetsRecents" tabindex="-1" class="titre-5">
        Mes trajets récents
      </h2>
      <template v-if="accord === 'accepte'">
        <p v-if="trajetsRecents.length === 0">Aucun trajet récent pour l’instant.</p>
        <template v-else>
          <ul class="sans-remplissage trajets-recents" aria-labelledby="titre-trajets-recents">
            <li v-for="trajet in trajetsRecents" :key="trajet.valideLe" class="marge-bas-2">
              <Bouton
                type="button"
                variante="discret"
                class="trajet-recent"
                :label="`De ${trajet.depart.libelle} à ${trajet.arrivee.libelle}`"
                :aria-label="`Reprendre le trajet ${descriptionTrajet(trajet.depart, trajet.arrivee)}`"
                @click="reprendre(trajet)"
              />
            </li>
          </ul>
          <div v-if="confirmationEffacement">
            <p ref="questionEffacement" tabindex="-1">
              Effacer tous vos trajets récents de ce téléphone ?
            </p>
            <div class="groupe-boutons">
              <Bouton
                type="button"
                label="Oui, effacer mes trajets récents"
                @click="effacer(true)"
              />
              <Bouton
                type="button"
                variante="secondaire"
                label="Annuler"
                @click="effacer(false)"
              />
            </div>
          </div>
          <Bouton
            v-else
            type="button"
            variante="secondaire"
            icone="corbeille"
            label="Effacer mes trajets récents"
            @click="demanderEffacement"
          />
        </template>
      </template>
      <template v-else-if="accord === 'refuse'">
        <p>Vos trajets ne sont pas gardés sur ce téléphone.</p>
        <Bouton
          type="button"
          variante="secondaire"
          label="Garder désormais mes trajets récents"
          @click="repondreAccord('accepte')"
        />
      </template>
      <p v-else>
        Après votre premier trajet, nous vous demanderons si vous voulez garder vos trajets récents
        sur ce téléphone.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* La carte occupe tout l'écran sous l'en-tête ; on fait défiler pour le détail et le pied de page. */
.ecran-carte {
  position: relative;
  height: calc(100vh - var(--haut-ecran-carte, 0px));
  height: calc(100dvh - var(--haut-ecran-carte, 0px));
  min-height: 20rem;
}
/* Posé en haut de la carte : la barre à gauche ; la carte reste touchable à côté. */
.haut-de-carte {
  position: absolute;
  inset: 0.5rem 0.5rem auto;
  z-index: 1100;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  max-height: calc(100% - 1rem);
  pointer-events: none;
}
.haut-de-carte > * {
  pointer-events: auto;
}
.panneau-resume {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.25rem 0.25rem 0.75rem;
  background: var(--fond);
  box-shadow: 0 2px 6px rgb(0 0 18 / 16%);
}
/* Le calcul en cours et les erreurs gardent toute la largeur, pour rester lisibles. */
.panneau-resume--large {
  flex-basis: 100%;
  padding: 0.5rem 0.75rem;
}
.barre-destination {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 36rem;
  max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - var(--haut-ecran-carte, 0px) - 1rem);
  overflow-y: auto;
  padding: 0.75rem 1rem;
  background: var(--fond);
  box-shadow: 0 2px 8px rgb(0 0 18 / 20%);
}
.barre-destination :deep(.marge-bas-6) {
  margin-bottom: 0.5rem !important;
}
.ligne-depart {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.25rem;
}
/* Cibles tactiles d'au moins 44 px. */
.bouton-barre {
  min-height: 2.75rem;
}
.bouton-deplier-barre,
.trajet-recent-sous-la-barre {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}
dt {
  font-weight: 700;
}
dd {
  margin: 0 0 1rem;
}
.duree-et-arrivee {
  display: flex;
  flex-wrap: wrap;
  gap: 0 2rem;
}
.etapes {
  overflow-wrap: anywhere;
}
.question-accord {
  border: 2px solid var(--bordure-legere);
  border-radius: 0.5rem;
}
.trajets-recents {
  list-style: none;
}
.trajet-recent {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
}
</style>
