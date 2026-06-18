<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Analysis {
  id: string
  userId: string
  nickname: string
  longitude: number
  latitude: number
  address: string
  createdAt: string
}

const loading = ref(false)
const analyses = ref<Analysis[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 模拟数据
const mockAnalyses: Analysis[] = [
  {
    id: '1',
    userId: '1',
    nickname: '用户8001',
    longitude: 116.397428,
    latitude: 39.90923,
    address: '北京市东城区天安门广场',
    createdAt: '2024-03-30 10:00:00',
  },
  {
    id: '2',
    userId: '2',
    nickname: '用户8002',
    longitude: 121.473701,
    latitude: 31.230416,
    address: '上海市黄浦区人民广场',
    createdAt: '2024-03-29 15:30:00',
  },
]

onMounted(() => {
  fetchAnalyses()
})

const fetchAnalyses = async () => {
  loading.value = true
  try {
    // TODO: 调用 API
    analyses.value = mockAnalyses
    total.value = mockAnalyses.length
  } finally {
    loading.value = false
  }
}

const viewDetail = (row: Analysis) => {
  console.log('查看详情:', row)
}
</script>

<template>
  <div class="analyses-page">
    <el-card shadow="hover">
      <el-table :data="analyses" v-loading="loading" stripe>
        <el-table-column prop="nickname" label="用户" width="120" />
        <el-table-column label="位置" min-width="200">
          <template #default="{ row }">
            <div>{{ row.address || `${row.longitude}, ${row.latitude}` }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="分析时间" width="180" />
        <el-table-column label="操作" fixed="right" width="120">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewDetail(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchAnalyses"
          @current-change="fetchAnalyses"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.analyses-page {
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
