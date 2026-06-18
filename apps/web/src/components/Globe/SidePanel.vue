<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import type { WeatherInfo } from '@/api/globe'
import { getBaguaDirection } from '@/utils/bagua'

interface Location {
  longitude: number
  latitude: number
  altitude: number | null
  address?: string
}

const props = defineProps<{
  location: Location | null
  weather: WeatherInfo | null
  loading?: boolean
}>()

const router = useRouter()
const isCollapsed = ref(false)

const currentTime = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
setInterval(() => {
  currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
}, 1000)

const formattedLocation = computed(() => {
  if (!props.location) return null
  return {
    longitude: props.location.longitude.toFixed(6),
    latitude: props.location.latitude.toFixed(6),
    altitude: props.location.altitude == null ? null : props.location.altitude.toFixed(2),
    address: props.location.address || '',
  }
})

const handleAnalyze = () => {
  if (props.location) {
    router.push({
      path: '/analysis',
      query: {
        lng: props.location.longitude,
        lat: props.location.latitude,
        alt: props.location.altitude,
      },
    })
  }
}
</script>

<template>
  <div class="side-panel" :class="{ collapsed: isCollapsed }">
    <button class="toggle-btn" @click="isCollapsed = !isCollapsed">
      {{ isCollapsed ? '◀' : '▶' }}
    </button>

    <div v-if="!isCollapsed" class="panel-content">
      <div class="panel-section">
        <h3 class="section-title">当前时间</h3>
        <div class="time-display">{{ currentTime }}</div>
      </div>

      <div v-if="formattedLocation" class="panel-section">
        <h3 class="section-title">位置信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">经度</span>
            <span class="value">{{ formattedLocation.longitude }}°</span>
          </div>
          <div class="info-item">
            <span class="label">纬度</span>
            <span class="value">{{ formattedLocation.latitude }}°</span>
          </div>
          <div class="info-item">
            <span class="label">海拔</span>
            <span class="value">{{ formattedLocation.altitude == null ? '加载中…' : formattedLocation.altitude + ' m' }}</span>
          </div>
          <div class="info-item">
            <span class="label">八卦方位</span>
            <span class="value">{{ getBaguaDirection(location?.longitude || 0) }}</span>
          </div>
          <div v-if="formattedLocation.address" class="info-item info-item--full">
            <span class="label">地址</span>
            <span class="value">{{ formattedLocation.address }}</span>
          </div>
        </div>
      </div>

      <div v-else class="panel-section">
        <p class="hint">点击地球选择位置</p>
      </div>

      <div v-if="formattedLocation" class="panel-section">
        <h3 class="section-title">天气信息</h3>
        <div v-if="weather" class="info-grid">
          <div class="info-item info-item--full">
            <span class="label">天气</span>
            <span class="value">{{ weather.weather }}</span>
          </div>
          <div class="info-item">
            <span class="label">温度</span>
            <span class="value">{{ weather.temperature }} °C</span>
          </div>
          <div class="info-item">
            <span class="label">湿度</span>
            <span class="value">{{ weather.humidity }} %</span>
          </div>
          <div class="info-item">
            <span class="label">风向</span>
            <span class="value">{{ weather.windDirection }}</span>
          </div>
          <div class="info-item">
            <span class="label">风速</span>
            <span class="value">{{ weather.windSpeed }} km/h</span>
          </div>
        </div>
        <p v-else-if="loading" class="hint">天气加载中…</p>
        <p v-else class="hint">暂无天气数据</p>
      </div>

      <div v-if="formattedLocation" class="panel-section">
        <button class="analyze-btn" @click="handleAnalyze">开始风水分析</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.side-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  background: rgba(26, 26, 46, 0.95);
  color: #fff;
  transition: width 0.3s ease;
  overflow: hidden;

  &.collapsed {
    width: 40px;
  }

  @media (max-width: 768px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    width: 100%;
    height: auto;
    max-height: 50vh;
    border-radius: 16px 16px 0 0;

    &.collapsed {
      height: 50px;
      width: 100%;
    }
  }
}

.toggle-btn {
  position: absolute;
  left: 8px;
  top: 12px;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  z-index: 10;

  @media (max-width: 768px) {
    right: 16px;
    left: auto;
  }
}

.panel-content {
  padding: 20px;
  padding-left: 40px;
  height: 100%;
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 16px;
    padding-top: 40px;
  }
}

.panel-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}

.time-display {
  font-size: 18px;
  font-weight: 600;
  color: #4a90d9;
  font-family: 'Monaco', 'Menlo', monospace;
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;

  .label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .value {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
  }

  &--full {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;

    .value {
      line-height: 1.4;
    }
  }
}

.hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.analyze-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
