<script setup lang="ts">
import NoticeModal from '@/components/modals/NoticeModal.vue'
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <!-- 全局房间解散提示（任意页面可见） -->
  <NoticeModal />
</template>

<style>
#app {
  width: 100%;
  min-height: 100vh;
}
</style>
