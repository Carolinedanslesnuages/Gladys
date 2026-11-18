<script lang="ts">
/** Petites icônes dessinées pour GLADYS (24 × 24). Décoratives : l'intitulé écrit à côté dit l'action. */
export const DESSINS_ICONES = {
  recherche: 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z',
  horloge: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.6l3.2 3.2-1.4 1.4L11 12.4V7h2Z',
  position: 'M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  valider: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
  flecheBas: 'M11 4h2v12.2l5.6-5.6L20 12l-8 8-8-8 1.4-1.4L11 16.2V4Z',
  flecheGauche: 'M20 11v2H7.8l5.6 5.6L12 20l-8-8 8-8 1.4 1.4L7.8 11H20Z',
  deplier: 'M12 15.5 5.5 9 7 7.5l5 5 5-5L18.5 9 12 15.5Z',
  replier: 'M12 8.5 18.5 15 17 16.5l-5-5-5 5L5.5 15 12 8.5Z',
  itineraire: 'M6 3a3 3 0 0 1 .5 5.96V11a1 1 0 0 0 1 1H16a3 3 0 0 1 .5 5.96V21h-2v-3.04A3 3 0 0 1 16 12H7.5a3 3 0 0 1-3-3V8.96A3 3 0 0 1 6 3Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  enregistrer: 'M4 3h13l3 3v15H4V3Zm2 2v14h12V6.8L16.2 5H15v5H7V5H6Zm3 0v3h4V5H9Zm-1 8h8v4H8v-4Z',
  etoile: 'm12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z',
  corbeille: 'M9 3h6l1 2h5v2H3V5h5l1-2ZM5 9h14l-1 12H6L5 9Zm4 2v8h2v-8H9Zm4 0v8h2v-8h-2Z',
  informations: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 4h2v2h-2V8Zm0 4h2v6h-2v-6Z',
  attention: 'M12 2 23 21H1L12 2Zm0 4.5L4.5 19h15L12 6.5ZM11 10h2v5h-2v-5Zm0 6h2v2h-2v-2Z',
  erreur: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 4h2v6h-2V8Zm0 8h2v2h-2v-2Z',
  recentrer: 'M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1V2Zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  arreter: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-3.5 3.6L12 11.2l3.5-3.6 1.4 1.4-3.5 3.6 3.5 3.6-1.4 1.4-3.5-3.6-3.5 3.6-1.4-1.4 3.5-3.6L7.1 9l1.4-1.4Z',
  boussole: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm4 4-2 6-6 2 2-6 6-2Zm-3.2 2.8-1.2 3.6 3.6-1.2 1.2-3.6-3.6 1.2Z',
  zoomPlus: 'M11 2a9 9 0 0 1 7.1 14.5l3.7 3.7-1.4 1.4-3.7-3.7A9 9 0 1 1 11 2Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-1 3h2v3h3v2h-3v3h-2v-3H7v-2h3V7Z',
  zoomMoins: 'M11 2a9 9 0 0 1 7.1 14.5l3.7 3.7-1.4 1.4-3.7-3.7A9 9 0 1 1 11 2Zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-4 6h8v2H7v-2Z',
  pleinEcran: 'M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5Z',
  quitterPleinEcran: 'M8 3h2v7H3V8h5V3Zm6 0h2v5h5v2h-7V3ZM3 14h7v7H8v-5H3v-2Zm11 0h7v2h-5v5h-2v-7Z',
  document: 'M6 2h9l5 5v15H6V2Zm2 2v16h10V8h-4V4H8Zm2 8h6v2h-6v-2Zm0 4h6v2h-6v-2Z',
  ajouter: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z',
  virageGauche: 'M16 22v-8a2 2 0 0 0-2-2H7.8l3.6 3.6L10 17l-6-6 6-6 1.4 1.4L7.8 10H14a4 4 0 0 1 4 4v8h-2Z',
  virageDroite: 'M8 22v-8a2 2 0 0 1 2-2h6.2l-3.6 3.6L14 17l6-6-6-6-1.4 1.4L16.2 10H10a4 4 0 0 0-4 4v8H8Z',
  toutDroit: 'M11 22V7.8L6.4 12.4 5 11l7-7 7 7-1.4 1.4L13 7.8V22h-2Z',
  demiTour: 'M8 22V9a4 4 0 0 1 8 0v3h2.5L15 16.5 11.5 12H14V9a2 2 0 0 0-4 0v13H8Z',
  arrivee: 'M5 3h2v1.5h11l-2 4 2 4H7V21H5V3Z',
} as const

export type NomIcone = keyof typeof DESSINS_ICONES
</script>

<script setup lang="ts">
defineProps<{ nom: NomIcone }>()
</script>

<template>
  <svg class="icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path :d="DESSINS_ICONES[nom]" fill="currentColor" fill-rule="evenodd" />
  </svg>
</template>

<style scoped>
.icone {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
}
</style>
