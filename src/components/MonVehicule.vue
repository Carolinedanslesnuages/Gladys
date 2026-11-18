<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import ChampSaisie from '@/components/interface/ChampSaisie.vue'
import GroupeRadios from '@/components/interface/GroupeRadios.vue'
import {
  MESSAGE_KILOMETRAGE_INVALIDE,
  kilometrageValide,
  useVehiculeStore,
  type EnergieVehicule,
} from '@/stores/vehicule'

/** « Mon véhicule » : motorisation et kilométrage, gardés sur ce téléphone. */
const magasinVehicule = useVehiculeStore()
const { energie, kilometrage, erreur } = storeToRefs(magasinVehicule)

const optionsEnergie = [
  { label: 'Thermique', value: 'thermique', hint: 'Essence ou diesel.' },
  { label: 'Électrique', value: 'electrique' },
]
const kilometrageSaisi = ref(kilometrage.value === null ? '' : String(kilometrage.value))
const erreurKilometrage = ref('')

function saisirKilometrage(valeur: string | number | undefined): void {
  kilometrageSaisi.value = String(valeur ?? '')
  if (kilometrageSaisi.value.trim() === '') {
    erreurKilometrage.value = ''
    return
  }
  const kilometrageSaisiValide = kilometrageValide(kilometrageSaisi.value)
  if (kilometrageSaisiValide === null) {
    erreurKilometrage.value = MESSAGE_KILOMETRAGE_INVALIDE
    return
  }
  erreurKilometrage.value = ''
  magasinVehicule.choisirKilometrage(kilometrageSaisiValide)
}
</script>

<template>
  <section id="mon-vehicule" class="marge-bas-8" aria-labelledby="titre-mon-vehicule">
    <h2 id="titre-mon-vehicule" class="titre-5">Mon véhicule</h2>
    <p class="texte-petit">Ces informations restent gardées sur ce téléphone.</p>
    <GroupeRadios
      name="energie-vehicule"
      legend="Ma voiture est…"
      :model-value="energie ?? ''"
      :options="optionsEnergie"
      @update:model-value="(valeur) => magasinVehicule.choisirEnergie(valeur as EnergieVehicule)"
    />
    <ChampSaisie
      id="kilometrage-vehicule"
      :model-value="kilometrageSaisi"
      label="Kilométrage de ma voiture, en km"
      indication="Le chiffre du compteur, par exemple 12500."
      :message-erreur="erreurKilometrage || erreur || undefined"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      @update:model-value="saisirKilometrage"
    />
    <p v-if="energie !== null && kilometrage !== null" id="vehicule-enregistre" role="status">
      Véhicule enregistré : {{ energie === 'electrique' ? 'électrique' : 'thermique' }},
      {{ kilometrage.toLocaleString('fr-FR') }} km.
    </p>
  </section>
</template>
