<script setup lang="ts">
import { RouterView } from 'vue-router'
import EtatConnexion from '@/components/EtatConnexion.vue'
import MiseAJour from '@/components/MiseAJour.vue'

const logoText = ['République', 'Française']
const liensRapides = [
  { label: 'Préparer mon trajet', to: '/', icon: 'fr-icon-road-map-line' },
  { label: 'Relevés', to: '/releves', icon: 'fr-icon-file-text-line' },
]
</script>

<template>
  <DsfrHeader
    service-title="Sans permis, en toute sécurité"
    :logo-text="logoText"
    :quick-links="liensRapides"
    home-to="/"
    operator-img-src="/logo-gladys.svg"
    operator-img-alt="Gladys"
    :operator-img-style="{ width: '7.75rem', height: '3rem' }"
  />
  <EtatConnexion />
  <MiseAJour />
  <!-- Chaque écran pose sa marge : l'accueil met la carte bord à bord. -->
  <main id="contenu">
    <RouterView />
  </main>
  <DsfrFooter :logo-text="logoText" />
</template>

<style>
/* Sur téléphone, l'en-tête reste compact pour laisser la place à la carte : l'accroche se masque
   (le logo GLADYS reste), les liens passent dans le menu. */
@media (max-width: 61.98em) {
  .fr-header .fr-header__service {
    display: none;
  }
}
</style>
