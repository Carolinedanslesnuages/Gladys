<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ErreurReseau, rechercherLieux, type Lieu } from '@/services/adresses'

/**
 * Champ « adresse ou commune » : pendant la saisie, propose les lieux trouvés par la Base Adresse
 * Nationale. Les propositions sont des boutons (clavier, lecteur d'écran) et leur nombre est annoncé.
 */
const props = defineProps<{
  id: string
  label: string
  enLigne: boolean
  /** Message d'erreur venu de l'écran (ex. : position refusée), affiché sous le champ. */
  erreurExterne?: string
}>()
const lieuChoisi = defineModel<Lieu | null>({ required: true })

const MESSAGE_SANS_RESEAU = 'La recherche d’adresse a besoin du réseau. Vous pouvez reprendre un de vos trajets récents.'
const NOMBRE_MINIMAL_DE_CARACTERES = 3
const DELAI_AVANT_RECHERCHE_EN_MS = 400

const texteTape = ref(lieuChoisi.value?.libelle ?? '')
const propositions = ref<Lieu[]>([])
const erreurRecherche = ref('')
const annonce = ref('')
let minuteurRecherche: ReturnType<typeof setTimeout> | undefined

const messageErreur = computed(() => props.erreurExterne || erreurRecherche.value || undefined)
const messageValide = computed(() =>
  lieuChoisi.value && !messageErreur.value ? `Lieu retenu : ${lieuChoisi.value.libelle}` : undefined,
)

// Lieu rempli par l'écran (trajet repris, position actuelle) : le champ l'affiche.
watch(lieuChoisi, (nouveauLieu) => {
  if (nouveauLieu && nouveauLieu.libelle !== texteTape.value) {
    texteTape.value = nouveauLieu.libelle
    propositions.value = []
    erreurRecherche.value = ''
  }
})

function saisir(valeur: string | number | undefined): void {
  texteTape.value = String(valeur ?? '')
  lieuChoisi.value = null
  propositions.value = []
  erreurRecherche.value = ''
  annonce.value = ''
  clearTimeout(minuteurRecherche)
  if (texteTape.value.trim().length >= NOMBRE_MINIMAL_DE_CARACTERES) {
    minuteurRecherche = setTimeout(rechercher, DELAI_AVANT_RECHERCHE_EN_MS)
  }
}

async function rechercher(): Promise<void> {
  if (!props.enLigne) {
    erreurRecherche.value = MESSAGE_SANS_RESEAU
    return
  }
  const texteRecherche = texteTape.value
  try {
    const lieuxTrouves = await rechercherLieux(texteRecherche)
    if (texteRecherche !== texteTape.value) return // la personne a continué de taper
    propositions.value = lieuxTrouves
    if (lieuxTrouves.length === 0) {
      erreurRecherche.value = `Adresse introuvable : « ${texteRecherche.trim()} ». Vérifiez l’orthographe ou essayez le nom de la commune.`
    } else {
      annonce.value =
        lieuxTrouves.length === 1
          ? '1 proposition, choisissez-la dans la liste sous le champ.'
          : `${lieuxTrouves.length} propositions, choisissez-en une dans la liste sous le champ.`
    }
  } catch (erreur) {
    if (!(erreur instanceof ErreurReseau)) throw erreur
    erreurRecherche.value = MESSAGE_SANS_RESEAU
  }
}

function choisir(lieu: Lieu): void {
  lieuChoisi.value = lieu
  texteTape.value = lieu.libelle
  propositions.value = []
  annonce.value = ''
  // Le bouton choisi disparaît : on rend le focus au champ.
  document.getElementById(props.id)?.focus()
}

onUnmounted(() => clearTimeout(minuteurRecherche))
</script>

<template>
  <div class="fr-mb-3w">
    <DsfrInputGroup
      :id="id"
      :model-value="texteTape"
      :label="label"
      label-visible
      hint="Une adresse ou le nom d’une commune, puis choisissez dans la liste"
      :error-message="messageErreur"
      :valid-message="messageValide"
      :disabled="!enLigne"
      required
      autocomplete="off"
      wrapper-class="fr-mb-1w"
      @update:model-value="saisir"
    />
    <p role="status" class="fr-sr-only">{{ annonce }}</p>
    <ul v-if="propositions.length > 0" class="fr-p-0 fr-m-0 propositions" :aria-label="`Propositions pour : ${label}`">
      <li v-for="lieu in propositions" :key="lieu.libelle">
        <DsfrButton type="button" tertiary size="lg" :label="lieu.libelle" class="proposition" @click="choisir(lieu)" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.propositions {
  list-style: none;
}
.proposition {
  width: 100%;
  text-align: left;
}
</style>
