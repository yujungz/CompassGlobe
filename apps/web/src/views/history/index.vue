<script setup lang="ts">
import { ref, onMounted } from 'vue'
import NavBar from '@/components/common/NavBar.vue'
import { analysisApi, type AnalysisRecord } from '@/api/analysis'

const PAGE_SIZE = 10

const list = ref<AnalysisRecord[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const deletingId = ref<string | null>(null)
const expandedId = ref<string | null>(null)

const hasMore = () => list.value.length < total.value

const load = async (reset = false) => {
  if (reset) {
    page.value = 1
  }
  loading.value = true
  try {
    const res = await analysisApi.getList(page.value, PAGE_SIZE)
    list.value = reset ? res.list : [...list.value, ...res.list]
    total.value = res.total
  } catch (e) {
    console.error('加载历史失败', e)
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  page.value += 1
  load(false)
}

const toggle = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

const remove = async (id: string) => {
  if (!window.confirm('确定删除这条分析记录？')) return
  deletingId.value = id
  try {
    await analysisApi.remove(id)
    // 当前页全部删完且前面还有数据时，回到上一页重载，避免空页
    if (list.value.length <= 1 && page.value > 1) {
      page.value -= 1
    }
    await load(true)
  } catch (e) {
    console.error('删除失败', e)
    alert('删除失败，请稍后重试')
  } finally {
    deletingId.value = null
  }
}

const extractScore = (content?: string): number | null => {
  if (!content) return null
  const m = content.match(/综合评分[^\d]*?(\d{1,3})/)
  const n = m ? parseInt(m[1]) : null
  return n != null && n >= 0 && n <= 100 ? n : null
}

const formatDate = (iso: string): string => new Date(iso).toLocaleString()

const locationLabel = (r: AnalysisRecord): string =>
  r.address || `${r.longitude.toFixed(4)}, ${r.latitude.toFixed(4)}`

onMounted(() => load(true))
</script>

<template>
  <div class="history-page">
    <NavBar />
    <div class="history-wrap">
      <div class="history-header">
        <h1 class="title">历史记录</h1>
        <p class="subtitle">共 {{ total }} 条风水分析</p>
      </div>

      <!-- 加载中（首次） -->
      <div v-if="loading && list.length === 0" class="state">加载中…</div>

      <!-- 空 -->
      <div v-else-if="list.length === 0" class="state empty">
        <p>暂无历史记录</p>
        <p class="hint">在地球仪选点进行风水分析后，记录会出现在这里</p>
      </div>

      <!-- 列表 -->
      <template v-else>
        <div
          v-for="r in list"
          :key="r.id"
          class="card"
          :class="{ expanded: expandedId === r.id }"
        >
          <div class="card-head" @click="toggle(r.id)">
            <div class="head-main">
              <span class="loc">{{ locationLabel(r) }}</span>
              <span class="meta">{{ formatDate(r.createdAt) }}</span>
            </div>
            <div class="head-right">
              <span v-if="extractScore(r.result?.content) != null" class="score">
                {{ extractScore(r.result?.content) }}
              </span>
              <span class="expand-icon">{{ expandedId === r.id ? '▲' : '▼' }}</span>
            </div>
          </div>

          <div v-if="r.weather?.weather" class="weather-snippet">
            {{ r.weather.weather }} · {{ r.weather.temperature }}°C
          </div>

          <div v-if="expandedId === r.id" class="card-detail">
            <div class="detail-meta">
              经度 {{ r.longitude.toFixed(6) }}° · 纬度 {{ r.latitude.toFixed(6) }}° · 海拔 {{ r.altitude.toFixed(1) }} m
            </div>
            <div class="detail-content">{{ r.result?.content }}</div>
            <div class="detail-actions">
              <button class="btn-danger" :disabled="deletingId === r.id" @click.stop="remove(r.id)">
                {{ deletingId === r.id ? '删除中…' : '删除' }}
              </button>
            </div>
          </div>
        </div>

        <button v-if="hasMore()" class="more-btn" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中…' : '加载更多' }}
        </button>
        <p v-else class="end-hint">没有更多了</p>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.history-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.history-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.history-header {
  text-align: center;
  margin-bottom: 24px;

  .title {
    font-size: 26px;
    margin: 0 0 8px;
  }
  .subtitle {
    color: rgba(255, 255, 255, 0.55);
    font-size: 13px;
    margin: 0;
  }
}

.state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.6);

  &.empty .hint {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.35);
    margin-top: 8px;
  }
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  transition: background 0.2s;

  &.expanded {
    background: rgba(255, 255, 255, 0.08);
  }
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;

  .head-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .loc {
    font-size: 15px;
    font-weight: 600;
  }
  .meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
  .head-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .expand-icon {
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
  }
}

.score {
  padding: 2px 10px;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  border-radius: 16px;
  font-size: 13px;
  font-weight: 700;
}

.weather-snippet {
  margin-top: 8px;
  font-size: 13px;
  color: #4a90d9;
}

.card-detail {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  .detail-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 12px;
  }
  .detail-content {
    white-space: pre-wrap;
    line-height: 1.8;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.88);
  }
  .detail-actions {
    margin-top: 16px;
    text-align: right;
  }
}

.btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: rgba(231, 76, 60, 0.2);
  color: #ff9f9f;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: rgba(231, 76, 60, 0.35);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.more-btn {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.end-hint {
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 16px;
}
</style>
