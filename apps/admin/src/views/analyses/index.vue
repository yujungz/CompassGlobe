<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isSuper = authStore.isSuper

interface Record { id: string; userId: string; longitude: number; latitude: number; altitude: number; address: string | null; result: any; createdAt: string }
const list = ref<Record[]>([])
const total = ref(0); const page = ref(1); const pageSize = ref(10); const loading = ref(false)

// 搜索
const searchForm = ref({ username: '', startDate: null as string | null | Date, endDate: null as string | null | Date })

// 详情对话框
const showDetail = ref(false)
const detail = ref<Record | null>(null)

// 本地日期格式化（避免 toISOString 时区偏移）
function fmtLocal(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 批量删除
const selectedIds = ref<string[]>([])
const deleting = ref(false)

function handleSelectionChange(rows: Record[]) { selectedIds.value = rows.map(r => r.id) }

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) { ElMessage.warning('请先选择要删除的记录'); return }
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条记录吗？此操作不可恢复。`, '批量删除', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    deleting.value = true
    await Promise.all(selectedIds.value.map(id => request.delete(`/admin/analyses/${id}`).catch(() => {})))
    ElMessage.success(`已删除 ${selectedIds.value.length} 条记录`)
    selectedIds.value = []
    fetchList()
  } catch { /* cancelled */ }
  finally { deleting.value = false }
}

onMounted(() => fetchList())

async function fetchList() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (searchForm.value.username) params.username = searchForm.value.username
    let sd = searchForm.value.startDate
    let ed = searchForm.value.endDate
    // 结束日期小于开始日期 → 自动等于开始日期
    if (sd && ed && sd instanceof Date && ed instanceof Date && ed < sd) {
      searchForm.value.endDate = new Date(sd)
      ed = new Date(sd)
    }
    if (sd && typeof sd !== 'string') params.startDate = fmtLocal(sd)
    if (ed && typeof ed !== 'string') params.endDate = fmtLocal(ed)
    const res: any = await request.get('/admin/analyses', { params })
    list.value = res.list || []; total.value = res.total || 0
  } catch { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

const handleSearch = () => { page.value = 1; fetchList() }
const handleReset = () => { searchForm.value = { username: '', startDate: null, endDate: null }; page.value = 1; fetchList() }

function openDetail(row: Record) { detail.value = row; showDetail.value = true }

async function handleDelete(row: Record) {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', { type: 'warning' })
    await request.delete(`/admin/analyses/${row.id}`)
    ElMessage.success('已删除')
    fetchList()
  } catch { /* cancelled */ }
}
</script>

<template>
  <div>
    <!-- 搜索 -->
    <el-card shadow="hover" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="搜索用户名" clearable style="width:160px" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="searchForm.startDate" type="date" placeholder="开始" style="width:140px" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="searchForm.endDate" type="date" placeholder="结束" style="width:140px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="hover">
      <div v-if="isSuper" style="margin-bottom:12px">
        <el-button type="danger" :disabled="selectedIds.length === 0" :loading="deleting" @click="handleBatchDelete">
          批量删除（{{ selectedIds.length }}）
        </el-button>
      </div>
      <el-table :data="list" v-loading="loading" stripe @selection-change="handleSelectionChange">
        <el-table-column v-if="isSuper" type="selection" width="50" />
        <el-table-column label="用户名" min-width="120">
          <template #default="{ row }">{{ row.user?.username || row.userId }}</template>
        </el-table-column>
        <el-table-column label="位置" min-width="200">
          <template #default="{ row }">{{ row.address || `${row.latitude?.toFixed(4)}, ${row.longitude?.toFixed(4)}` }}</template>
        </el-table-column>
        <el-table-column prop="altitude" label="海拔(m)" width="80" />
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="140">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openDetail(row)">查看详情</el-button>
            <el-button v-if="isSuper" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:20px;display:flex;justify-content:flex-end">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @size-change="fetchList" @current-change="fetchList" />
      </div>
    </el-card>

    <el-dialog v-model="showDetail" title="地理分析详情" width="640px">
      <div v-if="detail" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label style="color:#999;font-size:12px">用户名</label><div>{{ detail.user?.username || detail.userId }}</div></div>
        <div><label style="color:#999;font-size:12px">时间</label><div>{{ detail.createdAt ? new Date(detail.createdAt).toLocaleString('zh-CN') : '-' }}</div></div>
        <div><label style="color:#999;font-size:12px">经度</label><div>{{ detail.longitude }}</div></div>
        <div><label style="color:#999;font-size:12px">纬度</label><div>{{ detail.latitude }}</div></div>
        <div><label style="color:#999;font-size:12px">海拔</label><div>{{ detail.altitude }}m</div></div>
        <div style="grid-column:span 2"><label style="color:#999;font-size:12px">地址</label><div>{{ detail.address || '-' }}</div></div>
        <div style="grid-column:span 2"><label style="color:#999;font-size:12px">分析结果</label><div style="white-space:pre-wrap;max-height:300px;overflow-y:auto">{{ detail.result?.content || '-' }}</div></div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.search-card { margin-bottom: 20px; }
</style>
