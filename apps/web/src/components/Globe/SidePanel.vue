<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { globeApi, type WeatherInfo } from '@/api/globe'
import { getBaguaDirection } from '@/utils/bagua'
import CompassC from './Compass.vue'

interface NearbyPlace { name: string; type: string; address: string; distance: string; direction: string; longitude?: number | null; latitude?: number | null }

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
  heading?: number
}>()

const emit = defineEmits<{ (e: 'flyTo', lon: number, lat: number): void }>()

const router = useRouter()
const isCollapsed = ref(false)
const activeTab = ref<'info' | 'nearby' | 'compass'>('info')

const currentTime = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
setInterval(() => {
  currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
}, 1000)

// 附近地点
const nearbyPlaces = ref<NearbyPlace[]>([])
const nearbyLoading = ref(false)
const placeKeyword = ref('')
const placeSearching = ref(false)

watch(() => props.location, async (loc) => {
  if (loc) {
    nearbyLoading.value = true
    try {
      const res = await globeApi.getNearby(loc.longitude, loc.latitude)
      nearbyPlaces.value = res.places || []
    } catch { nearbyPlaces.value = [] }
    finally { nearbyLoading.value = false }
  } else {
    nearbyPlaces.value = []
  }
  placeKeyword.value = ''
}, { immediate: true })

async function searchPlace() {
  const kw = placeKeyword.value.trim()
  if (!kw || !props.location) return
  placeSearching.value = true
  try {
    const result = await globeApi.searchPlace(kw, props.location.longitude, props.location.latitude)
    if (result && result.longitude && result.latitude) {
      emit('flyTo', Number(result.longitude), Number(result.latitude))
      activeTab.value = 'info'
    } else {
      alert('未找到匹配的地点')
    }
  } catch { alert('搜索失败') }
  finally { placeSearching.value = false }
}

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
  } else {
    alert('请在地图上选择地点或点击定位图标')
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

      <!-- Tab 切换 -->
      <div v-if="formattedLocation" class="panel-tabs">
        <button :class="['tab-btn', { active: activeTab === 'info' }]" @click="activeTab = 'info'">信息</button>
        <button :class="['tab-btn', { active: activeTab === 'nearby' }]" @click="activeTab = 'nearby'">附近</button>
        <button :class="['tab-btn', { active: activeTab === 'compass' }]" @click="activeTab = 'compass'">罗盘</button>
      </div>

      <!-- 信息 Tab -->
      <template v-if="activeTab === 'info' || !formattedLocation">
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
          <div class="info-item">
            <span class="label">相机高度</span>
            <span class="value">{{ props.location?.cameraHeight ? (props.location.cameraHeight / 1000).toFixed(1) + ' km' : '—' }}</span>
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

      </template>

      <!-- 附近 Tab -->
      <template v-if="activeTab === 'nearby' && formattedLocation">
        <div class="panel-section">
          <h3 class="section-title">地点查询</h3>
          <div class="search-row">
            <input v-model="placeKeyword" class="search-input" placeholder="输入地点名称搜索…" @keydown.enter="searchPlace" />
            <button class="search-btn" :disabled="!placeKeyword.trim() || placeSearching" @click="searchPlace">{{ placeSearching ? '…' : '搜索' }}</button>
          </div>
        </div>
        <div class="panel-section">
          <h3 class="section-title">附近地点</h3>
          <div v-if="nearbyLoading" class="hint">搜索中…</div>
          <div v-else-if="nearbyPlaces.length === 0" class="hint">附近暂无收录地点</div>
          <div v-else class="nearby-list">
            <div v-for="(p, i) in nearbyPlaces.slice(0, 8)" :key="i" class="nearby-item" @click="emit('flyTo', Number(p.longitude) || props.location?.longitude || 0, Number(p.latitude) || props.location?.latitude || 0); activeTab = 'info'">
              <div class="nearby-left">
                <span class="nearby-name">{{ p.name }}</span>
                <span class="nearby-addr">{{ p.address }}</span>
              </div>
              <span class="nearby-info">{{ p.distance }}{{ p.direction ? ' · ' + p.direction : '' }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 罗盘 Tab -->
      <template v-if="activeTab === 'compass'">
        <div class="panel-section">
          <CompassC :heading="props.heading ?? 0" />
        </div>
      </template>

        <button class="analyze-btn" @click="handleAnalyze">风水分析</button>
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
    max-height: 55vh;
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;

    &.collapsed {
      height: 48px;
      width: 100%;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .analyze-btn {
      flex-shrink: 0;
      margin: 8px 16px 16px;
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
.panel-tabs {
  display: flex; gap: 4px; margin: 0 0 12px;
  background: rgba(255,255,255,.05); border-radius: 6px; padding: 3px;
  .tab-btn {
    flex: 1; padding: 8px; border: none; background: transparent;
    color: rgba(255,255,255,.5); border-radius: 4px; cursor: pointer; font-size: 13px;
    &.active { background: rgba(74,144,217,.2); color: #fff; }
  }
}

.search-row {
  display: flex; gap: 6px;
  .search-input {
    flex: 1; padding: 8px 10px; background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
    color: #fff; font-size: 13px;
    &::placeholder { color: rgba(255,255,255,.35); }
    &:focus { outline: none; border-color: #4a90d9; }
  }
  .search-btn {
    padding: 8px 14px; border: none; border-radius: 6px;
    background: #4a90d9; color: #fff; font-size: 13px; cursor: pointer; white-space: nowrap;
    &:hover:not(:disabled) { background: #357abd; }
    &:disabled { opacity: .5; cursor: not-allowed; }
  }
}

.nearby-list {
  display: flex; flex-direction: column; gap: 6px;
  .nearby-item {
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
    padding: 8px 4px; border-bottom: 1px solid rgba(255,255,255,.06);
    font-size: 13px; cursor: pointer; border-radius: 4px;
    &:hover { background: rgba(255,255,255,.04); }
    .nearby-left { flex: 1; min-width: 0;
      .nearby-name { color: rgba(255,255,255,.85); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .nearby-addr { color: rgba(255,255,255,.35); font-size: 11px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
    }
    .nearby-info { color: rgba(255,255,255,.4); font-size: 11px; white-space: nowrap; flex-shrink: 0; }
    &:last-child { border-bottom: none; }
  }
}
</style>
