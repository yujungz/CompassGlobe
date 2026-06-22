<script setup lang="ts">
import { RouterView } from 'vue-router'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
</script>

<template>
  <LoadingOverlay />
  <RouterView v-slot="{ Component }">
    <keep-alive include="Home,Analysis,FengshuiHome,Fortune,Divination,AiView">
      <component :is="Component" />
    </keep-alive>
  </RouterView>
</template>
