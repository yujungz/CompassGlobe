<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ heading: number }>()

// Cesium heading: 0=正北, 顺时针增加
// 罗盘旋转：外圈刻度不动，指针/中心旋转
const rotateAngle = computed(() => 360 - props.heading)

// 当前朝向对应的二十四山
const currentShan = computed(() => {
  const h = ((props.heading % 360) + 360) % 360
  const index = Math.round(h / 15) % 24
  return shanNames[index]
})

// 当前八卦方位
const currentGua = computed(() => {
  const h = ((props.heading % 360) + 360) % 360
  const names = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']
  const index = Math.round(h / 45) % 8
  return names[index]
})

const shanNames = ['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬']
</script>

<template>
  <div class="compass-container">
    <svg viewBox="0 0 200 200" class="compass-svg">
      <!-- 外圈 -->
      <circle cx="100" cy="100" r="95" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1" />

      <!-- 正北标记 -->
      <polygon points="100,3 97,12 103,12" fill="#e74c3c" />

      <!-- 旋转层：24 山刻度和指针 -->
      <g :style="{ transform: `rotate(${rotateAngle}deg)`, transformOrigin: '100px 100px' }">
        <!-- 24 山刻度线 -->
        <line
          v-for="(_, i) in shanNames"
          :key="i"
          :x1="100"
          :y1="i % 3 === 0 ? 12 : i % 3 === 1 ? 10 : 10"
          :x2="100"
          :y2="i % 3 === 0 ? 22 : 17"
          :stroke="i === 0 || i === 6 || i === 12 || i === 18 ? '#e74c3c' : 'rgba(255,255,255,.5)'"
          :stroke-width="i % 3 === 0 ? 1.5 : 0.8"
          :transform="`rotate(${i * 15}, 100, 100)`"
        />
        <!-- 山名标签 -->
        <text
          v-for="(name, i) in shanNames"
          :key="'t'+i"
          :x="100"
          :y="i % 3 === 0 ? 32 : i % 3 === 1 ? 25 : 25"
          text-anchor="middle"
          :fill="i === 0 || i === 6 || i === 12 || i === 18 ? '#e74c3c' : 'rgba(255,255,255,.6)'"
          :font-size="i % 3 === 0 ? '10' : '8'"
          :transform="`rotate(${i * 15}, 100, 100)`"
        >{{ name }}</text>

        <!-- 指针 -->
        <polygon points="100,35 97,45 103,45" fill="#4a90d9" />
      </g>

      <!-- 中心圆 -->
      <circle cx="100" cy="100" r="18" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.2)" stroke-width="1" />
    </svg>

    <div class="compass-info">
      <span class="compass-gua">{{ currentGua }}</span>
      <span class="compass-shan">{{ currentShan }}</span>
    </div>
  </div>
</template>

<style scoped>
.compass-container {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.compass-svg {
  width: 180px; height: 180px;
}
.compass-info {
  display: flex; gap: 8px; align-items: baseline;
  .compass-gua { font-size: 14px; color: #4a90d9; font-weight: 600; }
  .compass-shan { font-size: 13px; color: rgba(255,255,255,.6); }
}
</style>
