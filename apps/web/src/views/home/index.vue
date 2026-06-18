<script setup lang="ts">
import Globe from '@/components/Globe/Globe.vue'
import NavBar from '@/components/common/NavBar.vue'
import SidePanel from '@/components/Globe/SidePanel.vue'
import { globeApi, type WeatherInfo } from '@/api/globe'

import { ref } from 'vue'

interface SelectedLocation {
  longitude: number
  latitude: number
  altitude: number | null
  address?: string
}

const selectedLocation = ref<SelectedLocation | null>(null)
const weather = ref<WeatherInfo | null>(null)
const loading = ref(false)

// 选点后并行拉取海拔 / 天气 / 地址（真实海拔覆盖点击占位的 0）
const handleLocationSelect = async (loc: { longitude: number; latitude: number; altitude: number }) => {
  selectedLocation.value = { longitude: loc.longitude, latitude: loc.latitude, altitude: null }
  weather.value = null
  loading.value = true

  try {
    const [altRes, weatherRes, locRes] = await Promise.all([
      globeApi.getAltitude(loc.longitude, loc.latitude).catch(() => null),
      globeApi.getWeather(loc.longitude, loc.latitude).catch(() => null),
      globeApi.getLocationInfo(loc.longitude, loc.latitude).catch(() => null),
    ])

    // 防止快速连点：旧请求回来时若已选了新点则丢弃
    if (selectedLocation.value?.longitude !== loc.longitude || selectedLocation.value?.latitude !== loc.latitude) {
      return
    }

    if (altRes && typeof altRes.altitude === 'number') {
      selectedLocation.value.altitude = altRes.altitude
    }
    if (locRes?.address) {
      selectedLocation.value.address = locRes.address
    }
    if (weatherRes) {
      weather.value = weatherRes
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="home">
    <NavBar />
    <div class="home-content">
      <Globe @location-select="handleLocationSelect" />
      <SidePanel :location="selectedLocation" :weather="weather" :loading="loading" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.home {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  &-content {
    flex: 1;
    display: flex;
    position: relative;
    overflow: hidden;
  }
}
</style>
