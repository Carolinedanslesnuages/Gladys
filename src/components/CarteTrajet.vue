<script setup lang="ts">
/**
 * Carte du trajet retenu : fond OpenStreetMap (libre, sans compte), tracé, épingles « Départ »
 * (un rond) et « Arrivée » (un drapeau). Déplaçable et zoomable aux doigts, au clavier (flèches, + et −) et par deux
 * boutons. Sans réseau, le fond de carte est indisponible : un message le dit. La liste des étapes,
 * affichée sous la carte, en reste l'alternative écrite. Décision : docs/adr/0006-carte-du-trajet.md.
 * Pendant le trajet, la carte peut suivre la position de la personne, comme un GPS : son véhicule
 * au centre, tourné dans le sens de la marche, plein écran, bouton pour se recentrer, distance restante,
 * alerte si elle quitte le trajet. Décision : docs/adr/0008-guidage-sur-la-carte.md.
 * Fond OpenStreetMap plutôt que Plan IGN : docs/adr/0009-fond-de-carte-openstreetmap.md.
 * Carte d'accueil, comme une application de navigation : elle remplit la place que lui donne
 * l'écran, ses boutons sont posés dessus, et elle peut exister sans trajet (France entière, puis
 * la personne si elle autorise sa position). Décision : docs/adr/0010-accueil-carte-plein-ecran.md.
 * Pendant le suivi, le véhicule est placé plus bas que le centre (on voit la route devant) et la carte
 * tourne dans le sens de la marche, sauf si la personne garde le nord en haut.
 * Décision : docs/adr/0012-carte-dans-le-sens-de-la-marche.md.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Leaflet from 'leaflet'
import 'leaflet-rotate'
import Alerte from '@/components/interface/Alerte.vue'
import Bouton from '@/components/interface/Bouton.vue'
import 'leaflet/dist/leaflet.css'
import type { Lieu } from '@/services/adresses'
import type { PointDuTrace } from '@/services/itineraire'
import { PositionRefusee, suivrePosition, type Coordonnees } from '@/services/position'
import { avancementSurLeTrace, capDuTraceDevant, capEntre, distanceEntre } from '@/services/guidage'

const props = defineProps<{
  /** Tracé du trajet retenu ; vide tant qu'aucun itinéraire n'est calculé. */
  trace: PointDuTrace[]
  depart: Lieu | null
  arrivee: Lieu | null
  enLigne: boolean
  /** Trajet favori rouvert : sans réseau, la carte reste affichée avec les morceaux déjà vus (ADR 0013). */
  carteHorsConnexion?: boolean
  /** Carte d'accueil : chercher la personne dès l'ouverture, sans alerte si elle refuse. */
  suivreDesLOuverture?: boolean
}>()

/** Sans trajet ni position : la France métropolitaine entière. */
const CENTRE_DE_LA_FRANCE = Leaflet.latLng(46.6, 2.4)
const ZOOM_DE_LA_FRANCE = 6
const aUnTrajet = computed(() => props.trace.length >= 2)
const carteAffichee = computed(() => props.enLigne || Boolean(props.carteHorsConnexion))

/** Tuiles OpenStreetMap (serveur de la fondation, sans compte) : seule la zone affichée est demandée. */
const FOND_OPENSTREETMAP = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
/** Mention obligatoire de la licence OpenStreetMap (ODbL), avec un lien vers ses conditions. */
const MENTION_OPENSTREETMAP =
  'Fond de carte : © <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>'

const conteneurCarte = ref<HTMLElement | null>(null)
const zoneCarte = ref<HTMLElement | null>(null)
let carte: Leaflet.Map | null = null
let coucheDuTrajet: Leaflet.LayerGroup | null = null
let observateurDeTaille: ResizeObserver | null = null

const animationsReduites = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Forme d'une épingle de carte (28 × 40 px), sa pointe posée sur le lieu. */
const FORME_EPINGLE =
  'M14 1C7 1 1.5 6.5 1.5 13.5 1.5 23 14 39 14 39S26.5 23 26.5 13.5C26.5 6.5 21 1 14 1Z'
/** Dans l'épingle : un rond pour le départ, un drapeau pour l'arrivée (pas la couleur seule). */
const DESSIN_DANS_L_EPINGLE = {
  depart: '<circle class="dessin-epingle" cx="14" cy="13.5" r="5" />',
  arrivee: '<path class="dessin-epingle" d="M10 7.5h9l-2 3.25 2 3.25h-7.5v6H10Z" />',
} as const

/** Épingle « Départ » ou « Arrivée », nommée pour les lecteurs d'écran. */
const epingle = (genre: keyof typeof DESSIN_DANS_L_EPINGLE, libelle: string) =>
  Leaflet.divIcon({
    className: 'repere-carte',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    html:
      `<span class="epingle epingle--${genre}">` +
      '<svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true" focusable="false">' +
      `<path class="corps-epingle" d="${FORME_EPINGLE}" />${DESSIN_DANS_L_EPINGLE[genre]}</svg>` +
      `<span class="visuellement-cache">${libelle}</span></span>`,
  })

/**
 * Repère de la personne : son véhicule vu de dessus, centré sur sa position, tourné dans le sens de
 * la marche (vers le haut tant que la direction est inconnue), sans étiquette écrite.
 */
const repereDeLaPersonneIcone = () =>
  Leaflet.divIcon({
    className: 'repere-carte',
    iconSize: [0, 0],
    html:
      '<span class="repere-vous repere-vous--sans-direction">' +
      // Une voiture vue de dessus : quatre roues qui dépassent, des rétroviseurs, un capot qui
      // s'affine vers l'avant (en haut) et un pare-brise. Rien d'une locomotive.
      '<svg class="vehicule-vous" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" focusable="false">' +
      '<rect class="roue-vous" x="4.5" y="7" width="4" height="7" rx="1.5" />' +
      '<rect class="roue-vous" x="23.5" y="7" width="4" height="7" rx="1.5" />' +
      '<rect class="roue-vous" x="4.5" y="19" width="4" height="7" rx="1.5" />' +
      '<rect class="roue-vous" x="23.5" y="19" width="4" height="7" rx="1.5" />' +
      '<path class="carrosserie-vous" d="M16 2.5 C21.5 2.5 24.5 5 24.5 9 L25.5 14 L25.5 25 Q25.5 29.5 21 29.5 L11 29.5 Q6.5 29.5 6.5 25 L6.5 14 L7.5 9 C7.5 5 10.5 2.5 16 2.5 Z" />' +
      '<path class="vitre-vous" d="M9.5 13.5 Q16 10 22.5 13.5 L21.5 17.5 L10.5 17.5 Z" />' +
      '<path class="vitre-vous" d="M11 24 L21 24 L21.5 26 Q16 27.5 10.5 26 Z" /></svg>' +
      '<span class="visuellement-cache">Votre position</span></span>',
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
    // La carte peut tourner, mais seulement par GLADYS (sens de la marche) : pas de geste caché.
    rotate: true,
    rotateControl: false,
    touchRotate: false,
    shiftKeyRotate: false,
  })
  Leaflet.control.attribution({ prefix: false }).addAttribution(MENTION_OPENSTREETMAP).addTo(carte)
  Leaflet.tileLayer(FOND_OPENSTREETMAP, {
    minZoom: 6,
    maxZoom: 20,
    maxNativeZoom: 19,
    tileSize: 256,
  }).addTo(carte)
  coucheDuTrajet = Leaflet.layerGroup().addTo(carte)
  if (aUnTrajet.value) dessinerLeTrajet()
  else carte.setView(CENTRE_DE_LA_FRANCE, ZOOM_DE_LA_FRANCE, { animate: false })
  // Déplacer la carte à la main (doigt ou flèches du clavier) la détache de la personne, comme un GPS.
  carte.on('dragstart', detacherLaCarte)
  conteneur.addEventListener('keydown', (evenement) => {
    if (TOUCHES_DE_DEPLACEMENT.includes(evenement.key)) detacherLaCarte()
  })
  // La carte change de taille sans que la fenêtre bouge (plein écran, distance restante qui
  // apparaît au-dessus…) : Leaflet doit le savoir, puis la personne est remise au centre.
  if (typeof ResizeObserver === 'function') {
    observateurDeTaille = new ResizeObserver(() => {
      carte?.invalidateSize({ pan: false })
      garderLaPersonneAuCentre()
    })
    observateurDeTaille.observe(conteneur)
  }
  // Le véhicule reste tourné dans le bon sens à l'écran quand la carte tourne.
  carte.on('rotate', orienterLaFleche)
  if (props.suivreDesLOuverture && !suiviActif.value) demarrerLeSuivi({ automatique: true })
}

/** Tracé et épingles « Départ », « Arrivée » ; la carte se cadre sur tout le trajet. */
function dessinerLeTrajet(): void {
  if (!carte || !coucheDuTrajet) return
  coucheDuTrajet.clearLayers()
  if (!aUnTrajet.value) return
  const pointsDuTrace = props.trace.map((point) => Leaflet.latLng(point.latitude, point.longitude))
  const ligneDuTrajet = Leaflet.polyline(pointsDuTrace, {
    color: '#1f7a4d',
    weight: 5,
    interactive: false,
  }).addTo(coucheDuTrajet)
  const pointDeDepart = pointsDuTrace[0]!
  const pointDArrivee = pointsDuTrace[pointsDuTrace.length - 1]!
  Leaflet.marker(pointDeDepart, {
    icon: epingle('depart', 'Départ'),
    interactive: false,
    keyboard: false,
  }).addTo(coucheDuTrajet)
  Leaflet.marker(pointDArrivee, {
    icon: epingle('arrivee', 'Arrivée'),
    interactive: false,
    keyboard: false,
  }).addTo(coucheDuTrajet)
  // Le trajet en entier se lit nord en haut, comme sur une carte papier.
  carte.setBearing(0)
  carte.fitBounds(ligneDuTrajet.getBounds(), { padding: [24, 24], animate: false })
}

// Nouveau trajet calculé : on le montre en entier, sauf si la carte suit la personne. Alors, comme
// un GPS, la voiture est recentrée et la route est droit devant elle.
watch(
  () => props.trace,
  () => {
    dessinerLeTrajet()
    if (aUnTrajet.value && suiviActif.value && positionSuivie.value) {
      directionDeLaPersonne =
        positionSuivie.value.cap ?? capDuTraceDevant(positionSuivie.value, props.trace)
      recentrerSurLaPersonne()
      orienterLaFleche()
      messageDuSuivi.value = 'Trajet calculé : la carte vous suit, la route droit devant vous.'
    }
  },
)

function retirerCarte(): void {
  quitterLePleinEcran()
  arreterLeSuivi()
  observateurDeTaille?.disconnect()
  observateurDeTaille = null
  carte?.remove()
  carte = null
  coucheDuTrajet = null
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
/** Zoom après « Me recentrer » : la voiture est vue de près, comme dans Google Maps ou Waze. */
const ZOOM_DU_RECENTRAGE = 20
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

const avancement = computed(() =>
  positionSuivie.value && aUnTrajet.value
    ? avancementSurLeTrace(positionSuivie.value, props.trace)
    : null,
)

const enDistanceLisible = (metres: number) =>
  metres < 1000
    ? `${Math.round(metres / 10) * 10} m`
    : `${(metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`

/** Direction du GPS si le téléphone la donne, sinon celle du dernier déplacement. */
function directionDeMarche(
  positionPrecedente: Coordonnees | null,
  nouvellePosition: Coordonnees,
): number | null {
  if (nouvellePosition.cap !== undefined) return nouvellePosition.cap
  if (
    positionPrecedente &&
    distanceEntre(positionPrecedente, nouvellePosition) >=
      DEPLACEMENT_MINIMAL_POUR_LA_DIRECTION_METRES
  )
    return capEntre(positionPrecedente, nouvellePosition)
  // Direction encore inconnue (personne à l'arrêt) : celle de la route devant elle.
  return directionDeLaPersonne ?? capDuTraceDevant(nouvellePosition, props.trace)
}

/** Le véhicule pointe dans le sens de la marche à l'écran : sa direction, plus la rotation de la carte. */
function orienterLaFleche(): void {
  const repereAffiche = repereDeLaPersonne?.getElement()?.querySelector<HTMLElement>('.repere-vous')
  if (!repereAffiche || !carte) return
  repereAffiche.classList.toggle('repere-vous--sans-direction', directionDeLaPersonne === null)
  const directionALEcran = ((directionDeLaPersonne ?? 0) + carte.getBearing()) % 360
  repereAffiche.style.setProperty('--direction-vous', `${directionALEcran}deg`)
}

/** Carte dans le sens de la marche (choix par défaut) ou nord en haut. */
const sensDeLaMarche = ref(true)

/** Tant qu'elle suit la personne, la carte tourne pour que la route devant soit en haut de l'écran. */
function orienterLaCarte(): void {
  if (!carte || !carteCentreeSurLaPersonne.value) return
  if (!sensDeLaMarche.value) carte.setBearing(0)
  else if (directionDeLaPersonne !== null) carte.setBearing(360 - directionDeLaPersonne)
}

function basculerLeSensDeLaCarte(): void {
  sensDeLaMarche.value = !sensDeLaMarche.value
  if (!sensDeLaMarche.value) carte?.setBearing(0)
  else orienterLaCarte()
  garderLaPersonneAuCentre()
  messageDuSuivi.value = sensDeLaMarche.value
    ? 'La carte tourne dans le sens de la marche.'
    : 'Nord en haut : la carte ne tourne plus.'
}

/** Part de la hauteur de la carte entre le centre et le véhicule : on voit plus de route devant. */
const PART_DE_LA_HAUTEUR_SOUS_LE_CENTRE = 0.2

/**
 * Centre de la carte qui place la personne plus bas que le milieu de l'écran, même carte tournée :
 * le décalage « vers le haut de l'écran » est ramené dans le sens de la carte.
 */
function centreQuiMontreLaRouteDevant(point: Leaflet.LatLng, zoom: number): Leaflet.LatLng {
  if (!carte) return point
  const decalagePixels = carte.getSize().y * PART_DE_LA_HAUTEUR_SOUS_LE_CENTRE
  const rotationRadians = (carte.getBearing() * Math.PI) / 180
  const versLeHautDeLEcran = Leaflet.point(
    -decalagePixels * Math.sin(rotationRadians),
    -decalagePixels * Math.cos(rotationRadians),
  )
  return carte.unproject(carte.project(point, zoom).add(versLeHautDeLEcran), zoom)
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
  if (premierePosition) {
    carteCentreeSurLaPersonne.value = true
    messageDuSuivi.value = 'Position trouvée : la carte vous suit.'
  }
  orienterLaCarte()
  orienterLaFleche()
  if (carteCentreeSurLaPersonne.value) {
    const zoom = premierePosition ? ZOOM_DU_SUIVI : carte.getZoom()
    carte.setView(centreQuiMontreLaRouteDevant(point, zoom), zoom, {
      animate: !animationsReduites(),
    })
  }
}

/** Après un changement de taille de la carte, la personne suivie reste à sa place, sans animation. */
function garderLaPersonneAuCentre(): void {
  if (!carte || !suiviActif.value || !carteCentreeSurLaPersonne.value || !positionSuivie.value)
    return
  const point = Leaflet.latLng(positionSuivie.value.latitude, positionSuivie.value.longitude)
  carte.panTo(centreQuiMontreLaRouteDevant(point, carte.getZoom()), { animate: false })
}

function detacherLaCarte(): void {
  if (!suiviActif.value || !carteCentreeSurLaPersonne.value) return
  carteCentreeSurLaPersonne.value = false
  messageDuSuivi.value =
    'La carte ne vous suit plus. Utilisez « Me recentrer » pour revenir sur votre position.'
}

/** « Me recentrer » : revient sur la personne (ou commence à la suivre), comme le bouton flèche d'un GPS. */
function recentrerSurLaPersonne(): void {
  if (!suiviActif.value) {
    demarrerLeSuivi()
    return
  }
  carteCentreeSurLaPersonne.value = true
  messageDuSuivi.value = 'Carte recentrée : la carte vous suit.'
  orienterLaCarte()
  if (carte && positionSuivie.value) {
    const point = Leaflet.latLng(positionSuivie.value.latitude, positionSuivie.value.longitude)
    carte.setView(centreQuiMontreLaRouteDevant(point, ZOOM_DU_RECENTRAGE), ZOOM_DU_RECENTRAGE, {
      animate: !animationsReduites(),
    })
  }
}

function signalerErreurDuSuivi(erreur: Error, automatique: boolean): void {
  arreterLeSuivi()
  // À l'ouverture, sans position : la carte montre la France, sans alerte (la personne n'a rien demandé).
  if (automatique) {
    messageDuSuivi.value =
      'Position non disponible : la carte montre la France. « Me recentrer » la cherche à nouveau.'
    return
  }
  erreurDuSuivi.value =
    erreur instanceof PositionRefusee
      ? 'Position refusée : autorisez la localisation pour GLADYS dans les réglages du téléphone.'
      : 'Votre position est introuvable pour le moment. Réessayez dans un endroit dégagé.'
}

function demarrerLeSuivi({ automatique = false } = {}): void {
  erreurDuSuivi.value = ''
  messageDuSuivi.value = 'Recherche de votre position…'
  suiviActif.value = true
  carteCentreeSurLaPersonne.value = true
  arreterLaGeolocalisation = suivrePosition(placerLaPersonne, (erreur) =>
    signalerErreurDuSuivi(erreur, automatique),
  )
}

function arreterLeSuivi(): void {
  arreterLaGeolocalisation?.()
  arreterLaGeolocalisation = null
  repereDeLaPersonne?.remove()
  repereDeLaPersonne = null
  directionDeLaPersonne = null
  carte?.setBearing(0)
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
  carte?.invalidateSize({ pan: false })
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
  carte?.invalidateSize({ pan: false })
  document.getElementById('bouton-plein-ecran')?.focus()
}

const nomDeLaCarte = () =>
  aUnTrajet.value && props.depart && props.arrivee
    ? `Carte du trajet de ${props.depart.libelle} à ${props.arrivee.libelle}`
    : 'Carte autour de ma position'
</script>

<template>
  <div class="carte-complete">
    <div id="etat-carte" role="status" class="etat-carte">
      <Alerte
        v-if="!enLigne && carteHorsConnexion"
        type="info"
        description="Hors connexion : seuls les morceaux de carte déjà vus s’affichent. Les zones jamais regardées restent vides. Les étapes de votre trajet restent lisibles plus bas."
      />
      <Alerte
        v-else-if="!enLigne"
        type="info"
        description="Carte indisponible sans connexion. Les étapes de votre trajet restent lisibles plus bas."
      />
    </div>
    <div
      v-if="carteAffichee"
      id="zone-carte"
      ref="zoneCarte"
      class="zone-carte"
      :class="{ 'zone-carte--plein-ecran': pleinEcran }"
      :role="pleinEcran ? 'dialog' : undefined"
      :aria-modal="pleinEcran ? 'true' : undefined"
      :aria-label="pleinEcran ? 'Carte en plein écran' : undefined"
    >
      <p id="aide-carte" class="visuellement-cache">
        Déplacez la carte avec le doigt ou les flèches du clavier. Zoomez avec les boutons, ou les
        touches + et −. Votre position reste sur ce téléphone. Quand elle vous suit, la carte tourne
        dans le sens de la marche, sauf si vous gardez le nord en haut. Gardez les yeux sur la route
        : regardez la carte seulement à l’arrêt.
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
      <p id="annonce-suivi" role="status" class="visuellement-cache">{{ messageDuSuivi }}</p>
      <!-- Posés sur la carte : la distance restante en bas, les boutons à droite. -->
      <div v-if="erreurDuSuivi || avancement || $slots['sur-la-carte']" class="infos-carte">
        <!-- Ce que l'écran pose sur la carte (ex. : durée et distance du trajet). -->
        <slot name="sur-la-carte" :distance-restante-affichee="Boolean(avancement)" />
        <Alerte v-if="erreurDuSuivi" type="error" :description="erreurDuSuivi" />
        <!-- Discret, à droite : seule la distance restante se voit (ex. : « 22 km »). -->
        <div v-if="avancement" id="avancement-trajet" class="avancement">
          <p class="texte-grand marge-bas-0 panneau-distance-restante">
            <span class="visuellement-cache">Il vous reste </span
            ><strong>{{ enDistanceLisible(avancement.distanceRestanteMetres) }}</strong
            ><span class="visuellement-cache"> jusqu’à l’arrivée.</span>
          </p>
          <Alerte
            v-if="avancement.horsDuTrajet"
            type="warning"
            class="marge-haut-2"
            :description="`Vous êtes à ${enDistanceLisible(avancement.ecartAuTrajetMetres)} du trajet prévu. Rejoignez-le dès que possible, ou calculez un nouvel itinéraire.`"
          />
        </div>
      </div>
      <!-- Boutons compacts (icône seule) : leur nom complet est lu par les lecteurs d'écran et affiché au survol. -->
      <!-- Gros bouton avec son texte, à portée de pouce : on le touche d'un coup d'œil, sans viser. -->
      <Bouton
        v-if="pleinEcran || (suiviActif && !carteCentreeSurLaPersonne)"
        id="bouton-recentrer"
        type="button"
        icone="recentrer"
        label="Recentrer"
        aria-label="Me recentrer sur ma position"
        class="bouton-recentrer"
        @click="recentrerSurLaPersonne"
      />
      <div class="commandes-carte">
        <Bouton
          type="button"
          variante="secondaire"
          :icone="suiviActif ? 'arreter' : 'position'"
          icone-seule
          :label="suiviActif ? 'Arrêter' : 'Suivre'"
          :aria-label="
            suiviActif ? 'Arrêter de suivre ma position' : 'Suivre ma position sur la carte'
          "
          @click="basculerLeSuivi"
        />
        <Bouton
          v-if="suiviActif"
          type="button"
          variante="secondaire"
          icone="boussole"
          icone-seule
          :label="sensDeLaMarche ? 'Nord en haut' : 'Tourner'"
          :aria-label="
            sensDeLaMarche
              ? 'Garder le nord en haut de la carte'
              : 'Tourner la carte dans le sens de la marche'
          "
          @click="basculerLeSensDeLaCarte"
        />
        <Bouton
          type="button"
          variante="secondaire"
          icone="zoomPlus"
          icone-seule
          label="Zoomer"
          aria-label="Zoomer sur la carte"
          @click="zoomer"
        />
        <Bouton
          type="button"
          variante="secondaire"
          icone="zoomMoins"
          icone-seule
          label="Dézoomer"
          aria-label="Dézoomer la carte"
          @click="dezoomer"
        />
        <Bouton
          v-if="pleinEcran"
          id="bouton-quitter-plein-ecran"
          type="button"
          variante="secondaire"
          icone="quitterPleinEcran"
          icone-seule
          label="Quitter"
          aria-label="Quitter le plein écran"
          @click="quitterLePleinEcran"
        />
        <Bouton
          v-else
          id="bouton-plein-ecran"
          type="button"
          variante="secondaire"
          icone="pleinEcran"
          icone-seule
          label="Plein écran"
          aria-label="Afficher la carte en plein écran"
          @click="entrerEnPleinEcran"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* La carte remplit la place que l'écran lui donne (tout l'écran sous l'en-tête, à l'accueil). */
.carte-complete {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 18rem;
}
.etat-carte {
  position: absolute;
  inset: auto 0.5rem 0.5rem;
  z-index: 1000;
}
.zone-carte {
  position: absolute;
  inset: 0;
}
.zone-carte--plein-ecran {
  position: fixed;
  z-index: 1800;
  background: var(--fond);
}
.carte-trajet {
  position: absolute;
  inset: 0;
}
.carte-trajet:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: -4px;
}
/* Fonds blancs sous les éléments posés sur la carte : ils restent lisibles sur toutes les rues. */
.infos-carte {
  position: absolute;
  left: 0.5rem;
  right: 4.5rem;
  bottom: 1.75rem;
  z-index: 1000;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 0.5rem;
}
/* Côte à côte à droite (ex. : « 45 min » puis « 22 km ») ; une alerte prend toute la largeur. */
.infos-carte > .alerte,
.avancement:has(.alerte) {
  flex-basis: 100%;
}
.avancement {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.avancement > .alerte {
  align-self: stretch;
}
.panneau-distance-restante {
  padding: 0.5rem 0.75rem;
  background: var(--fond);
  box-shadow: 0 2px 6px rgb(0 0 18 / 16%);
}
.bouton-recentrer {
  position: absolute;
  left: 0.5rem;
  bottom: 1.75rem;
  z-index: 1000;
  min-height: 3.5rem;
  padding-inline: 1.25rem;
  font-size: 1.25rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgb(0 0 18 / 35%);
}
.commandes-carte {
  position: absolute;
  right: 0.5rem;
  bottom: 1.75rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--fond);
  box-shadow: 0 2px 6px rgb(0 0 18 / 16%);
}
/* Épingles du départ et de l'arrivée : bordure blanche pour rester visibles sur toutes les rues. */
.carte-trajet :deep(.epingle svg) {
  display: block;
  filter: drop-shadow(0 1px 2px rgb(0 0 18 / 40%));
}
.carte-trajet :deep(.corps-epingle) {
  stroke: var(--fond);
  stroke-width: 1.5;
}
.carte-trajet :deep(.epingle--depart .corps-epingle) {
  fill: var(--vert-route);
}
.carte-trajet :deep(.epingle--arrivee .corps-epingle) {
  fill: var(--erreur);
}
.carte-trajet :deep(.dessin-epingle) {
  fill: var(--fond);
}
/* Repère de la personne : le véhicule (24 px) est centré sur sa position. */
.carte-trajet :deep(.repere-vous) {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  line-height: 0;
  transform: translate(-50%, -50%);
}
.carte-trajet :deep(.vehicule-vous) {
  transform: rotate(var(--direction-vous, 0deg));
  transition: transform 0.3s ease-out;
}
.carte-trajet :deep(.carrosserie-vous) {
  fill: var(--vert-route);
  stroke: var(--fond);
  stroke-width: 2;
}
.carte-trajet :deep(.vitre-vous) {
  fill: var(--fond);
}
.carte-trajet :deep(.roue-vous) {
  fill: var(--fond);
  stroke: var(--vert-route);
  stroke-width: 1.5;
}
@media (prefers-reduced-motion: reduce) {
  .carte-trajet :deep(.vehicule-vous) {
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
