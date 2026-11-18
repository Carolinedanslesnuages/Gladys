<script setup lang="ts">
/**
 * Carte du trajet retenu : fond Plan IGN (service public, sans compte), tracé, repères « Départ »
 * et « Arrivée ». Déplaçable et zoomable aux doigts, au clavier (flèches, + et −) et par deux
 * boutons. Sans réseau, le fond de carte est indisponible : un message le dit. La liste des étapes,
 * affichée sous la carte, en reste l'alternative écrite. Décision : docs/adr/0006-carte-du-trajet.md.
 * Pendant le trajet, la carte peut suivre la position de la personne, comme un GPS : flèche « Vous »
 * tournée dans le sens de la marche, plein écran, bouton pour se recentrer, distance restante,
 * alerte si elle quitte le trajet. Décision : docs/adr/0008-guidage-sur-la-carte.md.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Lieu } from '@/services/adresses'
import type { PointDuTrace } from '@/services/itineraire'
import { PositionRefusee, suivrePosition, type Coordonnees } from '@/services/position'
import { avancementSurLeTrace, capEntre, distanceEntre } from '@/services/guidage'

const props = defineProps<{ trace: PointDuTrace[]; depart: Lieu; arrivee: Lieu; enLigne: boolean }>()

/** Tuiles du Plan IGN (Géoplateforme, WMTS) : seule la zone affichée est demandée. */
const FOND_PLAN_IGN =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
  '&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

const conteneurCarte = ref<HTMLElement | null>(null)
const zoneCarte = ref<HTMLElement | null>(null)
let carte: Leaflet.Map | null = null

const animationsReduites = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Repère écrit (« Départ », « Arrivée ») : l'information ne passe pas par la couleur seule. */
const repere = (libelle: string) =>
  Leaflet.divIcon({ className: 'repere-carte', html: `<span class="etiquette-repere">${libelle}</span>`, iconSize: [0, 0] })

/** Repère de la personne : une flèche tournée dans le sens de la marche (un rond tant qu'elle est inconnue), et « Vous ». */
const repereDeLaPersonneIcone = () =>
  Leaflet.divIcon({
    className: 'repere-carte',
    iconSize: [0, 0],
    html:
      '<span class="repere-vous repere-vous--sans-direction">' +
      '<svg class="fleche-vous" viewBox="0 0 32 32" width="40" height="40" aria-hidden="true" focusable="false">' +
      '<path d="M16 2 L28 29 L16 22 L4 29 Z" /></svg>' +
      '<span class="point-vous"></span>' +
      '<span class="etiquette-repere">Vous</span></span>',
  })

const TOUCHES_DE_DEPLACEMENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

function creerCarte(conteneur: HTMLElement): void {
  const sansAnimation = animationsReduites()
  carte = Leaflet.map(conteneur, {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    keyboard: true,
    renderer: Leaflet.svg(),
    zoomAnimation: !sansAnimation,
    fadeAnimation: !sansAnimation,
    markerZoomAnimation: !sansAnimation,
    inertia: !sansAnimation,
  })
  Leaflet.control.attribution({ prefix: false }).addAttribution('Fond de carte : © IGN').addTo(carte)
  Leaflet.tileLayer(FOND_PLAN_IGN, { minZoom: 6, maxZoom: 18, tileSize: 256 }).addTo(carte)
  const pointsDuTrace = props.trace.map((point) => Leaflet.latLng(point.latitude, point.longitude))
  const ligneDuTrajet = Leaflet.polyline(pointsDuTrace, { color: '#000091', weight: 5, interactive: false }).addTo(carte)
  const pointDeDepart = pointsDuTrace[0]!
  const pointDArrivee = pointsDuTrace[pointsDuTrace.length - 1]!
  Leaflet.marker(pointDeDepart, { icon: repere('Départ'), interactive: false, keyboard: false }).addTo(carte)
  Leaflet.marker(pointDArrivee, { icon: repere('Arrivée'), interactive: false, keyboard: false }).addTo(carte)
  carte.fitBounds(ligneDuTrajet.getBounds(), { padding: [24, 24], animate: false })
  // Déplacer la carte à la main (doigt ou flèches du clavier) la détache de la personne, comme un GPS.
  carte.on('dragstart', detacherLaCarte)
  conteneur.addEventListener('keydown', (evenement) => {
    if (TOUCHES_DE_DEPLACEMENT.includes(evenement.key)) detacherLaCarte()
  })
}

function retirerCarte(): void {
  quitterLePleinEcran()
  arreterLeSuivi()
  carte?.remove()
  carte = null
}

/** La carte suit son conteneur : créée quand il apparaît (réseau présent), retirée quand il disparaît. */
function suivreLeConteneur(conteneur: HTMLElement | null): void {
  if (conteneur && carte?.getContainer() === conteneur) return
  retirerCarte()
  if (conteneur) creerCarte(conteneur)
}
onMounted(() => suivreLeConteneur(conteneurCarte.value))
watch(conteneurCarte, suivreLeConteneur, { flush: 'post' })
onUnmounted(retirerCarte)

const zoomer = () => carte?.zoomIn(1, { animate: !animationsReduites() })
const dezoomer = () => carte?.zoomOut(1, { animate: !animationsReduites() })

// Suivi de la position pendant le trajet (comme un GPS). La position reste sur l'appareil.
/** Zoom du suivi : on lit le nom des rues autour de soi. */
const ZOOM_DU_SUIVI = 16
/** En dessous de ce déplacement, on garde la direction précédente (le GPS « tremble » à l'arrêt). */
const DEPLACEMENT_MINIMAL_POUR_LA_DIRECTION_METRES = 5
const suiviActif = ref(false)
const positionSuivie = ref<Coordonnees | null>(null)
const carteCentreeSurLaPersonne = ref(true)
const messageDuSuivi = ref('')
const erreurDuSuivi = ref('')
let arreterLaGeolocalisation: (() => void) | null = null
let repereDeLaPersonne: Leaflet.Marker | null = null
let directionDeLaPersonne: number | null = null

const avancement = computed(() => (positionSuivie.value ? avancementSurLeTrace(positionSuivie.value, props.trace) : null))

const enDistanceLisible = (metres: number) =>
  metres < 1000
    ? `${Math.round(metres / 10) * 10} m`
    : `${(metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`

/** Direction du GPS si le téléphone la donne, sinon celle du dernier déplacement. */
function directionDeMarche(positionPrecedente: Coordonnees | null, nouvellePosition: Coordonnees): number | null {
  if (nouvellePosition.cap !== undefined) return nouvellePosition.cap
  if (
    positionPrecedente &&
    distanceEntre(positionPrecedente, nouvellePosition) >= DEPLACEMENT_MINIMAL_POUR_LA_DIRECTION_METRES
  )
    return capEntre(positionPrecedente, nouvellePosition)
  return directionDeLaPersonne
}

function orienterLaFleche(): void {
  const repereAffiche = repereDeLaPersonne?.getElement()?.querySelector<HTMLElement>('.repere-vous')
  if (!repereAffiche) return
  repereAffiche.classList.toggle('repere-vous--sans-direction', directionDeLaPersonne === null)
  repereAffiche.style.setProperty('--direction-vous', `${directionDeLaPersonne ?? 0}deg`)
}

function placerLaPersonne(coordonnees: Coordonnees): void {
  if (!carte) return
  const positionPrecedente = positionSuivie.value
  const premierePosition = positionPrecedente === null
  directionDeLaPersonne = directionDeMarche(positionPrecedente, coordonnees)
  positionSuivie.value = coordonnees
  const point = Leaflet.latLng(coordonnees.latitude, coordonnees.longitude)
  if (repereDeLaPersonne) repereDeLaPersonne.setLatLng(point)
  else
    repereDeLaPersonne = Leaflet.marker(point, {
      icon: repereDeLaPersonneIcone(),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(carte)
  orienterLaFleche()
  if (premierePosition) {
    carteCentreeSurLaPersonne.value = true
    messageDuSuivi.value = 'Position trouvée : la carte vous suit.'
  }
  if (carteCentreeSurLaPersonne.value)
    carte.setView(point, premierePosition ? ZOOM_DU_SUIVI : carte.getZoom(), { animate: !animationsReduites() })
}

function detacherLaCarte(): void {
  if (!suiviActif.value || !carteCentreeSurLaPersonne.value) return
  carteCentreeSurLaPersonne.value = false
  messageDuSuivi.value = 'La carte ne vous suit plus. Utilisez « Me recentrer » pour revenir sur votre position.'
}

/** « Me recentrer » : revient sur la personne (ou commence à la suivre), comme le bouton flèche d'un GPS. */
function recentrerSurLaPersonne(): void {
  if (!suiviActif.value) {
    demarrerLeSuivi()
    return
  }
  carteCentreeSurLaPersonne.value = true
  messageDuSuivi.value = 'Carte recentrée : la carte vous suit.'
  if (carte && positionSuivie.value)
    carte.setView(Leaflet.latLng(positionSuivie.value.latitude, positionSuivie.value.longitude), ZOOM_DU_SUIVI, {
      animate: !animationsReduites(),
    })
}

function signalerErreurDuSuivi(erreur: Error): void {
  arreterLeSuivi()
  erreurDuSuivi.value =
    erreur instanceof PositionRefusee
      ? 'Position refusée : autorisez la localisation pour GLADYS dans les réglages du téléphone.'
      : 'Votre position est introuvable pour le moment. Réessayez dans un endroit dégagé.'
}

function demarrerLeSuivi(): void {
  erreurDuSuivi.value = ''
  messageDuSuivi.value = 'Recherche de votre position…'
  suiviActif.value = true
  carteCentreeSurLaPersonne.value = true
  arreterLaGeolocalisation = suivrePosition(placerLaPersonne, signalerErreurDuSuivi)
}

function arreterLeSuivi(): void {
  arreterLaGeolocalisation?.()
  arreterLaGeolocalisation = null
  repereDeLaPersonne?.remove()
  repereDeLaPersonne = null
  directionDeLaPersonne = null
  if (suiviActif.value) messageDuSuivi.value = 'La carte ne suit plus votre position.'
  suiviActif.value = false
  positionSuivie.value = null
}

const basculerLeSuivi = () => (suiviActif.value ? arreterLeSuivi() : demarrerLeSuivi())

// Plein écran, comme un GPS : la carte occupe tout l'écran ; le reste de la page est mis de côté
// (inerte) pour que le clavier et les lecteurs d'écran restent dans la carte. Échap en sort.
const pleinEcran = ref(false)
let elementsMisDeCote: HTMLElement[] = []

function mettreDeCoteLeResteDeLaPage(zone: HTMLElement): void {
  let element: HTMLElement | null = zone
  while (element && element !== document.body) {
    for (const voisin of Array.from(element.parentElement?.children ?? [])) {
      if (voisin !== element && voisin instanceof HTMLElement && !voisin.hasAttribute('inert')) {
        voisin.setAttribute('inert', '')
        elementsMisDeCote.push(voisin)
      }
    }
    element = element.parentElement
  }
}

function remettreLeResteDeLaPage(): void {
  for (const element of elementsMisDeCote) element.removeAttribute('inert')
  elementsMisDeCote = []
}

const sortirAvecEchap = (evenement: KeyboardEvent) => {
  if (evenement.key === 'Escape') quitterLePleinEcran()
}

async function entrerEnPleinEcran(): Promise<void> {
  pleinEcran.value = true
  document.body.classList.add('carte-en-plein-ecran')
  window.addEventListener('keydown', sortirAvecEchap)
  if (suiviActif.value) recentrerSurLaPersonne()
  else demarrerLeSuivi()
  await nextTick()
  carte?.invalidateSize()
  if (zoneCarte.value) mettreDeCoteLeResteDeLaPage(zoneCarte.value)
  document.getElementById('bouton-quitter-plein-ecran')?.focus()
}

async function quitterLePleinEcran(): Promise<void> {
  if (!pleinEcran.value) return
  pleinEcran.value = false
  document.body.classList.remove('carte-en-plein-ecran')
  window.removeEventListener('keydown', sortirAvecEchap)
  remettreLeResteDeLaPage()
  await nextTick()
  carte?.invalidateSize()
  document.getElementById('bouton-plein-ecran')?.focus()
}

const nomDeLaCarte = () => `Carte du trajet de ${props.depart.libelle} à ${props.arrivee.libelle}`
</script>

<template>
  <div id="etat-carte" role="status">
    <DsfrAlert
      v-if="!enLigne"
      type="info"
      small
      class="fr-mb-2w"
      description="Carte indisponible sans connexion. Les étapes de votre trajet restent lisibles ci-dessous."
    />
  </div>
  <div
    v-if="enLigne"
    id="zone-carte"
    ref="zoneCarte"
    :class="{ 'zone-carte--plein-ecran': pleinEcran }"
    :role="pleinEcran ? 'dialog' : undefined"
    :aria-modal="pleinEcran ? 'true' : undefined"
    :aria-label="pleinEcran ? 'Carte en plein écran' : undefined"
  >
    <template v-if="!pleinEcran">
      <div class="fr-btns-group fr-btns-group--inline fr-mb-1w">
        <DsfrButton
          id="bouton-plein-ecran"
          type="button"
          size="lg"
          icon="fr-icon-fullscreen-line"
          label="Afficher la carte en plein écran"
          @click="entrerEnPleinEcran"
        />
        <DsfrButton
          type="button"
          secondary
          size="lg"
          :icon="suiviActif ? 'fr-icon-close-circle-line' : 'fr-icon-map-pin-2-line'"
          :label="suiviActif ? 'Arrêter de suivre ma position' : 'Suivre ma position sur la carte'"
          @click="basculerLeSuivi"
        />
      </div>
      <p class="fr-text--sm fr-mb-1w">
        Votre position reste sur ce téléphone. Gardez les yeux sur la route : regardez la carte seulement à l’arrêt.
      </p>
    </template>
    <p id="annonce-suivi" role="status" class="fr-sr-only">{{ messageDuSuivi }}</p>
    <DsfrAlert v-if="erreurDuSuivi" type="error" small class="fr-mb-1w" :description="erreurDuSuivi" />
    <div v-if="avancement" id="avancement-trajet" class="fr-mb-1w">
      <p class="fr-text--lg fr-mb-1w">
        <strong>Il vous reste {{ enDistanceLisible(avancement.distanceRestanteMetres) }}</strong> jusqu’à l’arrivée.
      </p>
      <DsfrAlert
        v-if="avancement.horsDuTrajet"
        type="warning"
        small
        :description="`Vous êtes à ${enDistanceLisible(avancement.ecartAuTrajetMetres)} du trajet prévu. Rejoignez-le dès que possible, ou calculez un nouvel itinéraire.`"
      />
    </div>
    <p id="aide-carte" class="fr-text--sm fr-mb-1w" :class="{ 'fr-sr-only': pleinEcran }">
      Déplacez la carte avec le doigt ou les flèches du clavier. Zoomez avec les boutons, ou les touches + et −.
      <template v-if="pleinEcran">Touche Échap pour quitter le plein écran.</template>
    </p>
    <div
      id="carte-trajet"
      ref="conteneurCarte"
      class="carte-trajet"
      role="region"
      :aria-label="nomDeLaCarte()"
      aria-describedby="aide-carte"
    ></div>
    <div class="fr-btns-group fr-btns-group--inline fr-mt-1w fr-mb-0">
      <DsfrButton
        v-if="pleinEcran || (suiviActif && !carteCentreeSurLaPersonne)"
        type="button"
        :size="pleinEcran ? 'md' : 'lg'"
        icon="fr-icon-focus-3-line"
        label="Me recentrer sur ma position"
        @click="recentrerSurLaPersonne"
      />
      <DsfrButton
        type="button"
        secondary
        :size="pleinEcran ? 'md' : 'lg'"
        icon="fr-icon-zoom-in-line"
        label="Zoomer sur la carte"
        @click="zoomer"
      />
      <DsfrButton
        type="button"
        secondary
        :size="pleinEcran ? 'md' : 'lg'"
        icon="fr-icon-zoom-out-line"
        label="Dézoomer la carte"
        @click="dezoomer"
      />
      <DsfrButton
        v-if="pleinEcran"
        id="bouton-quitter-plein-ecran"
        type="button"
        tertiary
        size="md"
        icon="fr-icon-collapse-line"
        label="Quitter le plein écran"
        @click="quitterLePleinEcran"
      />
    </div>
  </div>
</template>

<style scoped>
.carte-trajet {
  width: 100%;
  height: 18rem;
  border: 1px solid var(--border-default-grey);
}
.carte-trajet:focus-visible {
  outline: 2px solid #0a76f6;
  outline-offset: 2px;
}
.zone-carte--plein-ecran {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  background: var(--background-default-grey);
}
.zone-carte--plein-ecran .carte-trajet {
  flex: 1 1 auto;
  height: auto;
  min-height: 10rem;
}
.carte-trajet :deep(.etiquette-repere) {
  display: inline-block;
  width: max-content;
  padding: 0.125rem 0.5rem;
  border: 2px solid var(--border-action-high-blue-france);
  background: var(--background-default-grey);
  color: var(--text-action-high-blue-france);
  font-weight: 700;
  font-size: 0.875rem;
  transform: translate(-50%, -50%);
}
/* Repère de la personne : la flèche est centrée sur sa position, « Vous » écrit dessous. */
.carte-trajet :deep(.repere-vous) {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -20px);
}
.carte-trajet :deep(.repere-vous .etiquette-repere) {
  transform: none;
}
.carte-trajet :deep(.fleche-vous) {
  transform: rotate(var(--direction-vous, 0deg));
  fill: var(--background-action-high-blue-france);
  stroke: var(--background-default-grey);
  stroke-width: 2.5;
  stroke-linejoin: round;
  transition: transform 0.3s ease-out;
}
.carte-trajet :deep(.point-vous) {
  display: none;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0.5rem;
  border: 3px solid var(--background-default-grey);
  border-radius: 50%;
  background: var(--background-action-high-blue-france);
}
.carte-trajet :deep(.repere-vous--sans-direction .fleche-vous) {
  display: none;
}
.carte-trajet :deep(.repere-vous--sans-direction .point-vous) {
  display: block;
}
@media (prefers-reduced-motion: reduce) {
  .carte-trajet :deep(.fleche-vous) {
    transition: none;
  }
}
</style>

<style>
/* La page derrière la carte en plein écran ne défile plus. */
body.carte-en-plein-ecran {
  overflow: hidden;
}
</style>
