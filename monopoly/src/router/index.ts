import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/online-lobby',
    name: 'online-lobby',
    component: () => import('@/views/OnlineLobbyView.vue')
  },
  {
    path: '/online-room',
    name: 'online-room',
    component: () => import('@/views/OnlineRoomView.vue')
  },
  {
    path: '/game',
    name: 'game',
    component: () => import('@/views/GameView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
