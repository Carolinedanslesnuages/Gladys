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
    service-title="GLADYS"
    service-description=""
    :logo-text="logoText"
    :quick-links="liensRapides"
    home-to="/"
    operator-img-src="/logo-gladys.svg"
    operator-img-alt="Gladys"
    :operator-img-style="{ width: '7.75rem', height: '3rem' }"
  />
  <EtatConnexion />
  <MiseAJour />
  <main id="contenu" class="fr-container fr-my-6w">
    <RouterView />
  </main>
  <DsfrFooter :logo-text="logoText" />
</template>
