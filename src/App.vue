<script setup lang="ts">
import { RouterView } from 'vue-router'
import EtatConnexion from '@/components/EtatConnexion.vue'
import MiseAJour from '@/components/MiseAJour.vue'

const logoText = ['République', 'Française']
</script>

<template>
  <DsfrHeader
    service-title="LÉON"
    service-description=""
    :logo-text="logoText"
    home-to="/"
  />
  <EtatConnexion />
  <MiseAJour />
  <main id="contenu" class="fr-container fr-my-6w">
    <RouterView />
  </main>
  <DsfrFooter :logo-text="logoText" />
</template>
