<script setup lang="ts">
defineOptions({ name: 'Home' }) // 供 <keep-alive include="Home"> 匹配，切走不销毁、保留地球仪状态

import Globe from '@/components/Globe/Globe.vue'
import NavBar from '@/components/common/NavBar.vue'
import SidePanel from '@/components/Globe/SidePanel.vue'
import { globeApi, type WeatherInfo } from '@/api/globe'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getBaguaDirection } from '@/utils/bagua'

interface SelectedLocation {
  longitude: number
  latitude: number
  altitude: number | null
  address?: string
  cameraHeight?: number
}

const selectedLocation = ref<SelectedLocation | null>(null)
const weather = ref<WeatherInfo | null>(null)
const loading = ref(false)
const globeRef = ref<InstanceType<typeof Globe>>()
const liveCameraHeight = ref(0)
const cameraHeading = ref(0)

// 移动端检测
const windowWidth = ref(window.innerWidth)
function onResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
const isMobile = computed(() => windowWidth.value < 768)

// ===== 陀螺仪（手机物理朝向） =====
const deviceHeading = ref<number | null>(null)
const gyroAvailable = ref(false)
const useGyro = ref(false) // 是否使用陀螺仪方向
let gyroTimer: ReturnType<typeof setTimeout> | null = null

async function requestGyroPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const granted = await (DeviceOrientationEvent as any).requestPermission()
      if (granted !== 'granted') return false
    } catch { return false }
  }
  return true
}

function onDeviceOrientation(event: DeviceOrientationEvent) {
  if (event.alpha !== null) {
    deviceHeading.value = event.alpha
    gyroAvailable.value = true
  }
}

// 相机更新时调用：2 秒内保持相机朝向，之后切换回陀螺仪
function onCameraUpdate(height: number, heading: number) {
  liveCameraHeight.value = height
  cameraHeading.value = heading
  if (selectedLocation.value) selectedLocation.value.cameraHeight = height
  // 用户正在操作地球仪 → 用相机朝向
  useGyro.value = false
  if (gyroTimer) clearTimeout(gyroTimer)
  gyroTimer = setTimeout(() => { useGyro.value = true }, 2000)
}

// 智能切换：操作地球仪时用相机朝向，静止后用陀螺仪
const effectiveHeading = computed(() => {
  if (gyroAvailable.value && useGyro.value && deviceHeading.value !== null) return deviceHeading.value
  return cameraHeading.value
})

// 当前朝向对应的二十四山
const currentShan = computed(() => {
  const h = ((effectiveHeading.value % 360) + 360) % 360
  const names = ['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬']
  return names[Math.round(h / 15) % 24]
})

// SidePanel 附近地点 → 地球仪飞过去
const handleFlyTo = async (lon: number, lat: number) => {
  globeRef.value?.flyTo(lon, lat)
  await handleLocationSelect({ longitude: lon, latitude: lat, altitude: 0 })
}

// 相机更新 → onCameraUpdate（含智能切换逻辑）
const handleCameraUpdate = onCameraUpdate

// 初始化：请求陀螺仪权限 + 注册事件
onMounted(async () => {
  if (isMobile.value) {
    const ok = await requestGyroPermission()
    if (ok) window.addEventListener('deviceorientation', onDeviceOrientation)
  }
})
onUnmounted(() => {
  window.removeEventListener('deviceorientation', onDeviceOrientation)
})

// 选点后并行拉取海拔 / 天气 / 地址
const handleLocationSelect = async (loc: { longitude: number; latitude: number; altitude: number }) => {
  selectedLocation.value = { longitude: loc.longitude, latitude: loc.latitude, altitude: null, cameraHeight: liveCameraHeight.value }
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
      <Globe ref="globeRef" @location-select="handleLocationSelect" @camera-update="handleCameraUpdate" />
      <SidePanel :location="selectedLocation" :weather="weather" :loading="loading" :heading="effectiveHeading" @fly-to="handleFlyTo" />

      <!-- 移动端 HUD 覆盖层 -->
      <div v-if="isMobile && selectedLocation" class="mobile-hud">
        <!-- 微型罗盘 -->
        <div class="hud-compass">
          <svg viewBox="0 0 44 44" class="hud-svg">
            <circle cx="22" cy="22" r="20" fill="rgba(0,0,0,.4)" stroke="rgba(255,255,255,.15)" stroke-width=".5"/>
            <text x="22" y="6" text-anchor="middle" fill="#e74c3c" font-size="7" font-weight="bold">N</text>
            <g :style="{ transform: `rotate(${-effectiveHeading}deg)`, transformOrigin: '22px 22px' }">
              <line x1="22" y1="5" x2="22" y2="9" stroke="#e74c3c" stroke-width="1"/>
              <line x1="22" y1="35" x2="22" y2="39" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>
            </g>
            <circle cx="22" cy="22" r="3" fill="rgba(74,144,217,.7)"/>
          </svg>
          <div v-if="gyroAvailable" class="hud-gyro-badge" title="陀螺仪已启用">G</div>
        </div>

        <!-- 位置信息 -->
        <div class="hud-info">
          <div class="hud-address">{{ selectedLocation.address || '加载中…' }}</div>
          <div class="hud-meta">
            <span class="hud-shan">{{ currentShan }}</span>
            <span class="hud-degree">{{ Math.round(((effectiveHeading % 360) + 360) % 360) }}°</span>
            <span v-if="selectedLocation.cameraHeight" class="hud-alt">{{ (selectedLocation.cameraHeight / 1000).toFixed(1) }}km</span>
          </div>
        </div>
      </div>
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

.mobile-hud {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  pointer-events: none;
  max-width: 75%;
}

.hud-compass {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  position: relative;

  .hud-gyro-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 14px;
    height: 14px;
    background: #4a90d9;
    border-radius: 50%;
    font-size: 8px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
}

.hud-info {
  background: rgba(0,0,0,.55);
  border-radius: 8px;
  padding: 6px 10px;
  min-width: 0;

  .hud-address {
    font-size: 11px;
    color: rgba(255,255,255,.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }

  .hud-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 10px;

    .hud-shan { color: #4a90d9; font-weight: 600; }
    .hud-degree { color: rgba(255,255,255,.6); }
    .hud-alt { color: rgba(255,255,255,.4); }
  }
}
</style>
