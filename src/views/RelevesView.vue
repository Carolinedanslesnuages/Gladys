<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRelevesStore } from '@/stores/releves'
import Alerte from '@/components/interface/Alerte.vue'
import Bouton from '@/components/interface/Bouton.vue'
import ChampSaisie from '@/components/interface/ChampSaisie.vue'
import Icone from '@/components/interface/Icone.vue'

const magasin = useRelevesStore()
const { releves, erreur } = storeToRefs(magasin)
const texte = ref('')
const erreurSaisie = ref('')
const annonce = ref('')

function ajouter(): void {
  if (!texte.value.trim()) {
    erreurSaisie.value = 'Écrivez le relevé avant de l’ajouter'
    return
  }
  magasin.ajouter(texte.value)
  annonce.value = 'Relevé ajouté.'
  texte.value = ''
  erreurSaisie.value = ''
}

function supprimer(id: string): void {
  magasin.supprimer(id)
  annonce.value = 'Relevé supprimé.'
}

const dateLisible = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="conteneur marge-verticale-12">
    <!-- Sans en-tête, ce lien ramène à la carte (et à son bouton « À propos »). -->
    <RouterLink to="/" class="lien-retour"><Icone nom="flecheGauche" />Retour à la carte</RouterLink>
    <h1 class="marge-haut-4">GLADYS</h1>
    <p>Exemple : des relevés saisis sur le terrain, même sans réseau. Ils restent sur cet appareil.</p>

    <form novalidate class="marge-bas-8" @submit.prevent="ajouter">
      <ChampSaisie id="nouveau-releve" v-model="texte" label="Nouveau relevé" :message-erreur="erreurSaisie" />
      <Bouton type="submit" label="Ajouter" icone="ajouter" />
    </form>

    <p role="status" class="visuellement-cache">{{ annonce }}</p>
    <Alerte v-if="erreur" type="error" :description="erreur" class="marge-bas-4" />

    <h2 class="titre-5">Relevés ({{ releves.length }})</h2>
    <p v-if="releves.length === 0">Aucun relevé pour l’instant.</p>
    <ul v-else class="sans-remplissage releves">
      <li v-for="releve in releves" :key="releve.id" class="marge-bas-4">
        <p class="marge-bas-1">{{ releve.texte }}</p>
        <p class="texte-petit marge-bas-1">Saisi le {{ dateLisible(releve.saisiLe) }}</p>
        <Bouton
          variante="discret"
          label="Supprimer"
          :aria-label="`Supprimer le relevé « ${releve.texte} »`"
          @click="supprimer(releve.id)"
        />
      </li>
    </ul>

    <details class="installer marge-haut-8">
      <summary>Installer l’application sur mon téléphone</summary>
      <ul>
        <li><strong>Android (Chrome, Edge)</strong> : menu ⋮, puis « Installer l’application ».</li>
        <li><strong>iPhone (Safari)</strong> : bouton Partager, puis « Sur l’écran d’accueil ».</li>
        <li><strong>Ordinateur (Chrome, Edge)</strong> : icône d’installation dans la barre d’adresse.</li>
      </ul>
      <p class="marge-bas-0">Une fois installée, elle s’ouvre comme une application et fonctionne sans réseau.</p>
    </details>
  </div>
</template>

<style scoped>
.releves {
  list-style: none;
}
.lien-retour {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--cible-minimale);
}
.installer {
  border: 2px solid var(--bordure-legere);
  border-radius: 0.5rem;
}
.installer summary {
  min-height: var(--cible-minimale);
  padding: 0.75rem 1rem;
  font-weight: 600;
  cursor: pointer;
}
.installer > :not(summary) {
  margin-left: 1rem;
  margin-right: 1rem;
}
.installer > :last-child {
  margin-bottom: 1rem;
}
</style>
