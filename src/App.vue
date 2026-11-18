<script setup lang="ts">
import { RouterView } from 'vue-router'
import EtatConnexion from '@/components/EtatConnexion.vue'
import MiseAJour from '@/components/MiseAJour.vue'
</script>

<template>
  <!-- Application mobile : ni en-tête ni pied de page de site, la carte prend tout l'écran.
       Le logo et les informations légales sont dans le panneau « À propos »
       (bouton « À propos » sous la carte, docs/adr/0011-application-sans-en-tete-ni-pied-de-page.md). -->
  <EtatConnexion />
  <MiseAJour />
  <main id="contenu">
    <RouterView />
  </main>
</template>
