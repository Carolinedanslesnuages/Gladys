import { createRouter, createWebHistory } from 'vue-router'
import ConduiteView from '../views/ConduiteView.vue'
import RelevesView from '../views/RelevesView.vue'
import TrajetView from '../views/TrajetView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'trajet', component: TrajetView, meta: { titre: 'Préparer mon trajet' } },
    { path: '/conduite', name: 'conduite', component: ConduiteView, meta: { titre: 'Consigne de conduite' } },
    { path: '/releves', name: 'releves', component: RelevesView, meta: { titre: 'Relevés' } },
  ],
})

// Titre de page qui dit où l'on est (RGAA 8.6).
router.afterEach((destination) => {
  document.title = `${String(destination.meta.titre ?? 'Accueil')} — GLADYS`
})

export default router
