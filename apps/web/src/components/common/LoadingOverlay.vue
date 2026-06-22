<script setup lang="ts">
import { useGlobalLoading } from '@/composables/useGlobalLoading'

const { globalLoading, globalElapsed, globalMessage, formatTime } = useGlobalLoading()
</script>

<template>
  <div v-if="globalLoading" class="loading-overlay no-print">
    <div class="loader">
      <div class="spinner"></div>
      <p class="msg">{{ globalMessage }}</p>
      <p class="timer">已耗时 {{ formatTime(globalElapsed) }}</p>
    </div>
  </div>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.loader {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 40px 48px;
  text-align: center;
  min-width: 200px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.msg {
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  margin: 0 0 6px;
}

.timer {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin: 0;
}
</style>
