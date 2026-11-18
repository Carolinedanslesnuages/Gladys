<script setup lang="ts">
/**
 * Carte du trajet retenu : fond Plan IGN (service public, sans compte), tracé, repères « Départ »
 * et « Arrivée ». Déplaçable et zoomable aux doigts, au clavier (flèches, + et −) et par deux
 * boutons. Sans réseau, le fond de carte est indisponible : un message le dit. La liste des étapes,
 * affichée sous la carte, en reste l'alternative écrite. Décision : docs/adr/0006-carte-du-trajet.md.
 * Pendant le trajet, la carte peut suivre la position de la personne, comme un GPS : repère « Vous »,
 * distance restante, alerte si elle quitte le trajet. Décision : docs/adr/0008-guidage-sur-la-carte.md.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Lieu } from '@/services/adresses'
import type { PointDuTrace } from '@/services/itineraire'
import { PositionRefusee, suivrePosition, type Coordonnees } from '@/services/position'
import { avancementSurLeTrace } from '@/services/guidage'

const props = defineProps<{ trace: PointDuTrace[]; depart: Lieu; arrivee: Lieu; enLigne: boolean }>()

/** Tuiles du Plan IGN (Géoplateforme, WMTS) : seule la zone affichée est demandée. */
const FOND_PLAN_IGN =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
  '&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

const conteneurCarte = ref<HTMLElement | null>(null)
let carte: Leaflet.Map | null = null

const animationsReduites = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Repère écrit (« Départ », « Arrivée ») : l'information ne passe pas par la couleur seule. */
const repere = (libelle: string) =>
  Leaflet.divIcon({ className: 'repere-carte', html: `<span class="etiquette-repere">${libelle}</span>`, iconSize: [0, 0] })

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
}

function retirerCarte(): void {
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
const suiviActif = ref(false)
const positionSuivie = ref<Coordonnees | null>(null)
const messageDuSuivi = ref('')
const erreurDuSuivi = ref('')
let arreterLaGeolocalisation: (() => void) | null = null
let repereDeLaPersonne: Leaflet.Marker | null = null

const avancement = computed(() => (positionSuivie.value ? avancementSurLeTrace(positionSuivie.value, props.trace) : null))

const enDistanceLisible = (metres: number) =>
  metres < 1000
    ? `${Math.round(metres / 10) * 10} m`
    : `${(metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`

function placerLaPersonne(coordonnees: Coordonnees): void {
  if (!carte) return
  const premierePosition = positionSuivie.value === null
  positionSuivie.value = coordonnees
  const point = Leaflet.latLng(coordonnees.latitude, coordonnees.longitude)
  if (repereDeLaPersonne) repereDeLaPersonne.setLatLng(point)
  else
    repereDeLaPersonne = Leaflet.marker(point, {
      icon: repere('Vous'),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(carte)
  carte.setView(point, premierePosition ? ZOOM_DU_SUIVI : carte.getZoom(), { animate: !animationsReduites() })
  if (premierePosition) messageDuSuivi.value = 'Position trouvée : la carte vous suit.'
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
  arreterLaGeolocalisation = suivrePosition(placerLaPersonne, signalerErreurDuSuivi)
}

function arreterLeSuivi(): void {
  arreterLaGeolocalisation?.()
  arreterLaGeolocalisation = null
  repereDeLaPersonne?.remove()
  repereDeLaPersonne = null
  if (suiviActif.value) messageDuSuivi.value = 'La carte ne suit plus votre position.'
  suiviActif.value = false
  positionSuivie.value = null
}

const basculerLeSuivi = () => (suiviActif.value ? arreterLeSuivi() : demarrerLeSuivi())

const nomDeLaCarte =() => `Carte du trajet de ${props.depart.libelle} à ${props.arrivee.libelle}`
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
  <template v-if="enLigne">
    <DsfrButton
      type="button"
      size="lg"
      class="fr-mb-1w"
      :icon="suiviActif ? 'fr-icon-close-circle-line' : 'fr-icon-map-pin-2-line'"
      :label="suiviActif ? 'Arrêter de suivre ma position' : 'Suivre ma position sur la carte'"
      @click="basculerLeSuivi"
    />
    <p class="fr-text--sm fr-mb-1w">
      Votre position reste sur ce téléphone. Gardez les yeux sur la route : regardez la carte seulement à l’arrêt.
    </p>
    <p id="annonce-suivi" role="status" class="fr-sr-only">{{ messageDuSuivi }}</p>
    <DsfrAlert v-if="erreurDuSuivi" type="error" small class="fr-mb-2w" :description="erreurDuSuivi" />
    <div v-if="avancement" id="avancement-trajet" class="fr-mb-2w">
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
    <p id="aide-carte" class="fr-text--sm fr-mb-1w">
      Déplacez la carte avec le doigt ou les flèches du clavier. Zoomez avec les boutons, ou les touches + et −.
    </p>
    <div
      id="carte-trajet"
      ref="conteneurCarte"
      class="carte-trajet"
      role="region"
      :aria-label="nomDeLaCarte()"
      aria-describedby="aide-carte"
    ></div>
    <div class="fr-btns-group fr-btns-group--inline fr-mt-1w">
      <DsfrButton type="button" secondary size="lg" icon="fr-icon-zoom-in-line" label="Zoomer sur la carte" @click="zoomer" />
      <DsfrButton type="button" secondary size="lg" icon="fr-icon-zoom-out-line" label="Dézoomer la carte" @click="dezoomer" />
    </div>
  </template>
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
</style>
