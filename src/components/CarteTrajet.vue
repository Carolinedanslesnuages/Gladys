<script setup lang="ts">
/**
 * Carte du trajet retenu : fond Plan IGN (service public, sans compte), tracé, repères « Départ »
 * et « Arrivée ». Déplaçable et zoomable aux doigts, au clavier (flèches, + et −) et par deux
 * boutons. Sans réseau, le fond de carte est indisponible : un message le dit. La liste des étapes,
 * affichée sous la carte, en reste l'alternative écrite. Décision : docs/adr/0006-carte-du-trajet.md.
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Lieu } from '@/services/adresses'
import type { PointDuTrace } from '@/services/itineraire'

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
  <template v-if="enLigne">
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
