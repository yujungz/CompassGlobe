<script setup lang="ts">
import { ref, onMounted, onActivated, shallowRef } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { globeApi } from '@/api/globe'
import { gcj02ToWgs84 } from '@/utils/coord'

const props = defineProps<{
  initialView?: {
    longitude: number
    latitude: number
    height: number
  }
}>()

const emit = defineEmits<{
  locationSelect: [location: { longitude: number; latitude: number; altitude: number }]
  cameraUpdate: [height: number, heading: number]
}>()

const cesiumContainer = ref<HTMLDivElement>()
const viewer = shallowRef<Cesium.Viewer>()

const locating = ref(false)
const locationMsg = ref('')

// 定位按钮拖动
const savedPos = localStorage.getItem('locate-btn-pos')
const btnLeft = ref(savedPos ? parseFloat(savedPos.split(',')[0]) : 0)
const btnBottom = ref(savedPos ? parseFloat(savedPos.split(',')[1]) : 100)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, btnLeft: 0, btnBottom: 0 })

function onDragStart(e: PointerEvent) {
  if (locating.value) return
  dragging.value = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  dragStart.value = { x: e.clientX, y: e.clientY, btnLeft: btnLeft.value, btnBottom: btnBottom.value }
}

function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragStart.value.x
  const dy = dragStart.value.y - e.clientY
  btnLeft.value = Math.max(0, dragStart.value.btnLeft + dx)
  btnBottom.value = Math.max(0, Math.min(window.innerHeight - 100, dragStart.value.btnBottom + dy))
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  localStorage.setItem('locate-btn-pos', `${btnLeft.value},${btnBottom.value}`)
}

const MIN_HEIGHT = 100    // 最小高度 0.1km
const MAX_HEIGHT = 20000000 // 最大高度 20000km

function getCameraHeight(): number {
  if (!viewer.value) return 0
  return Cesium.Cartographic.fromCartesian(
    viewer.value.camera.position,
    Cesium.Ellipsoid.WGS84
  ).height
}
let msgTimer: ReturnType<typeof setTimeout> | null = null

// 展示一条短暂提示（4 秒后自动消失）
const showMsg = (text: string) => {
  locationMsg.value = text
  if (msgTimer) clearTimeout(msgTimer)
  msgTimer = setTimeout(() => {
    locationMsg.value = ''
  }, 4000)
}

onMounted(() => {
  initCesium()
})

// keep-alive 重新激活时画布从 detached 恢复，触发 resize 避免尺寸异常
onActivated(() => {
  viewer.value?.resize()
})

// 构造天地图瓦片 Provider（img_w 卫星影像 / cia_w 中文注记，均为 Web Mercator）
const createTdtProvider = (layer: string, key: string) =>
  new Cesium.UrlTemplateImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/DataServer?T=${layer}&x={x}&y={y}&l={z}&tk=${key}`,
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    maximumLevel: 18,
  })

// 选中并标记一个点（点击 / 定位共用）：通知父组件 + 落红色标记
const selectAndMark = (longitude: number, latitude: number, altitude: number) => {
  emit('locationSelect', { longitude, latitude, altitude })
  viewer.value?.entities.removeAll()
  viewer.value?.entities.add({
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude),
    point: {
      pixelSize: 10,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
  })
}

const initCesium = async () => {
  if (!cesiumContainer.value) return

  // 拉取天地图密钥
  let tdtKey = ''
  try {
    const res = await globeApi.getTdtKey()
    tdtKey = res.key || ''
  } catch (e) {
    console.warn('获取天地图密钥失败，回退默认底图', e)
  }

  // 配置了天地图密钥则关闭默认底图，由天地图瓦片接管
  viewer.value = new Cesium.Viewer(cesiumContainer.value, {
    baseLayer: tdtKey ? false : undefined,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: false,
    selectionIndicator: false,
  })

  // 天地图底图：img_w 卫星影像打底 + cia_w 中文注记叠加
  if (tdtKey) {
    viewer.value.imageryLayers.addImageryProvider(createTdtProvider('img_w', tdtKey))
    viewer.value.imageryLayers.addImageryProvider(createTdtProvider('cia_w', tdtKey))
  }

  // 设置初始视角（中国）
  const initialView = props.initialView || { longitude: 116.3912, latitude: 39.9062, height: 15000000 }
  viewer.value.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(initialView.longitude, initialView.latitude, initialView.height),
  })

  // 缩放限制（Cesium 原生控制，不会导致视图异常）
  if (viewer.value.scene.screenSpaceCameraController) {
    viewer.value.scene.screenSpaceCameraController.minimumZoomDistance = MIN_HEIGHT
    viewer.value.scene.screenSpaceCameraController.maximumZoomDistance = MAX_HEIGHT
  }

  // 相机高度 + 朝向实时更新
  viewer.value.camera.changed.addEventListener(() => {
    emit('cameraUpdate', getCameraHeight(), Cesium.Math.toDegrees(viewer.value!.camera.heading))
  })

  // 点击事件
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas)
  handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const cartesian = viewer.value?.camera.pickEllipsoid(event.position, viewer.value.scene.globe.ellipsoid)
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      const longitude = Cesium.Math.toDegrees(cartographic.longitude)
      const latitude = Cesium.Math.toDegrees(cartographic.latitude)
      selectAndMark(longitude, latitude, 0)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

// 定位到当前位置（浏览器 Geolocation）
const locateCurrentPosition = () => {
  if (!navigator.geolocation) {
    showMsg('当前环境不支持定位（需 HTTPS 或 localhost 访问）')
    return
  }
  if (locating.value) return

  // Chrome/chromium 在非 HTTPS 下静默拒绝；给明确提示
  if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    showMsg('定位功能需要 HTTPS，请使用 https:// 访问')
    return
  }

  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false
      // 中国大陆浏览器返回的坐标是 GCJ-02，需转换为 WGS-84
      const rawLng = position.coords.longitude
      const rawLat = position.coords.latitude
      const wgs = gcj02ToWgs84(rawLng, rawLat)
      const altitude = position.coords.altitude ?? 0
      selectAndMark(wgs.lng, wgs.lat, altitude)
      viewer.value?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(wgs.lng, wgs.lat, 10000),
        duration: 2,
      })
    },
    (error) => {
      locating.value = false
      const msgMap: Record<number, string> = {
        1: '定位权限被拒绝，请在浏览器设置中允许位置权限后重试',
        2: '暂时无法获取位置，请稍后重试',
        3: '定位超时，请重试',
      }
      showMsg(msgMap[error.code] || `定位失败：${error.message}`)
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  )
}

function flyTo(longitude: number, latitude: number) {
  if (!viewer.value) return
  viewer.value.entities.removeAll()
  viewer.value.entities.add({
    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
    point: { pixelSize: 10, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
  })
  const currentHeight = getCameraHeight()
  const height = Math.min(currentHeight, 5000)
  viewer.value.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
    duration: 2,
  })
}

defineExpose({
  locateCurrentPosition,
  flyTo,
  getCameraHeight,
})
</script>

<template>
  <div class="globe">
    <div ref="cesiumContainer" class="cesium-container"></div>
    <div class="globe-controls" :style="{ left: btnLeft + 'px', bottom: btnBottom + 'px' }">
      <button
        class="control-btn"
        :disabled="locating"
        :title="locating ? '定位中…' : '定位当前位置（可拖动，双击定位）'"
        @dblclick="locateCurrentPosition"
        @pointerdown="onDragStart"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
      >
        {{ locating ? '⏳' : '📍' }}
      </button>
      <div v-if="locationMsg" class="location-msg">{{ locationMsg }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.globe {
  width: 100%;
  height: 100%;
  position: relative;

  .cesium-container {
    width: 100%;
    height: 100%;
  }

  &-controls {
    position: absolute;
    left: 16px;
    bottom: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 10;

    .control-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      border: none;
      font-size: 20px;
      cursor: grab;
      touch-action: none;
      user-select: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: all 0.2s;

      &:active { cursor: grabbing; }

      &:hover:not(:disabled) {
        background: #fff;
        transform: scale(1.1);
      }

      &:disabled {
        opacity: 0.6;
        cursor: wait;
      }
    }

    .location-msg {
      max-width: 180px;
      padding: 8px 12px;
      background: rgba(26, 26, 46, 0.92);
      color: #fff;
      font-size: 12px;
      line-height: 1.5;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      text-align: center;
    }
  }
}
</style>
