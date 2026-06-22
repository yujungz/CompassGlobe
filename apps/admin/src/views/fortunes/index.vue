<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isSuper = authStore.isSuper

interface Record { id: string; name: string; predictYear: number; baZi: any; result: any; createdAt: string; user?: { username: string }; userId: string }
const list = ref<Record[]>([])
const total = ref(0); const page = ref(1); const pageSize = ref(10); const loading = ref(false)
const showDetail = ref(false); const detail = ref<any>(null)
function fmtLocal(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const searchForm = ref({ username: '', startDate: null as Date | null, endDate: null as Date | null })
const selectedIds = ref<string[]>([])
const deleting = ref(false)

onMounted(() => fetchList())

async function fetchList() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    if (searchForm.value.username) params.username = searchForm.value.username
    let sd = searchForm.value.startDate
    let ed = searchForm.value.endDate
    if (sd && ed && sd instanceof Date && ed instanceof Date && ed < sd) {
      searchForm.value.endDate = new Date(sd)
      ed = new Date(sd)
    }
    if (sd && typeof sd !== 'string') params.startDate = fmtLocal(sd)
    if (ed && typeof ed !== 'string') params.endDate = fmtLocal(ed)
    const res: any = await request.get('/admin/fortune-records', { params })
    list.value = res.list || []; total.value = res.total || 0
  } catch { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

const handleSearch = () => { page.value = 1; fetchList() }
const handleReset = () => { searchForm.value = { username: '', startDate: null, endDate: null }; page.value = 1; fetchList() }
function handleSelectionChange(rows: Record[]) { selectedIds.value = rows.map(r => r.id) }

async function openDetail(row: Record) {
  try {
    const res: any = await request.get(`/admin/fortune-records/${row.id}`)
    detail.value = res
  } catch { detail.value = row }
  showDetail.value = true
}
function downloadPdf(id: string, apiPath: string, label: string) {
  const token = localStorage.getItem('admin_token')
  if (!token) return
  fetch(`/api/admin/pdf${apiPath}/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob()).then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = label; a.click(); URL.revokeObjectURL(url) }).catch(() => {})
}

async function handleDelete(row: Record) {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', { type: 'warning' })
    await request.delete(`/admin/fortune-records/${row.id}`)
    ElMessage.success('已删除'); fetchList()
  } catch { /* cancelled */ }
}
async function handleBatchDelete() {
  if (selectedIds.value.length === 0) { ElMessage.warning('请先选择要删除的记录'); return }
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条记录吗？`, '批量删除', { type: 'warning', confirmButtonText: '确认删除' })
    deleting.value = true
    await Promise.all(selectedIds.value.map(id => request.delete(`/admin/fortune-records/${id}`).catch(() => {})))
    ElMessage.success(`已删除 ${selectedIds.value.length} 条记录`)
    selectedIds.value = []; fetchList()
  } catch { /* cancelled */ }
  finally { deleting.value = false }
}
</script>

<template>
  <div>
    <el-card shadow="hover" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="用户名"><el-input v-model="searchForm.username" placeholder="搜索用户名" clearable style="width:160px" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="searchForm.startDate" type="date" placeholder="开始" style="width:140px" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="searchForm.endDate" type="date" placeholder="结束" style="width:140px" /></el-form-item>
        <el-form-item><el-button type="primary" @click="handleSearch">搜索</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="hover">
      <div v-if="isSuper" style="margin-bottom:12px">
        <el-button type="danger" :disabled="selectedIds.length === 0" :loading="deleting" @click="handleBatchDelete">批量删除（{{ selectedIds.length }}）</el-button>
      </div>
      <el-table :data="list" v-loading="loading" stripe @selection-change="handleSelectionChange">
        <el-table-column v-if="isSuper" type="selection" width="50" />
        <el-table-column prop="name" label="姓名" min-width="80" />
        <el-table-column label="用户名" min-width="120"><template #default="{ row }">{{ row.user?.username || row.userId }}</template></el-table-column>
        <el-table-column prop="predictYear" label="预测年份" width="100" />
        <el-table-column label="时间" min-width="160"><template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template></el-table-column>
        <el-table-column label="操作" min-width="140">
          <template #default="{ row }">
            <el-button size="small" @click="downloadPdf(row.id, '/fortune', `流年大运_${row.name}_${row.predictYear}`)">PDF</el-button>
            <el-button size="small" type="primary" @click="openDetail(row)">查看详情</el-button>
            <el-button v-if="isSuper" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:20px;display:flex;justify-content:flex-end">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @size-change="fetchList" @current-change="fetchList" />
      </div>
    </el-card>
    <el-dialog v-model="showDetail" title="流年大运详情" width="640px">
      <div v-if="detail" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label>姓名</label><div>{{ detail.name }}</div></div>
        <div><label>性别</label><div>{{ detail.gender === 'male' ? '男' : '女' }}</div></div>
        <div><label>预测年份</label><div>{{ detail.predictYear }}</div></div>
        <div><label>时间</label><div>{{ detail.createdAt ? new Date(detail.createdAt).toLocaleString('zh-CN') : '-' }}</div></div>
        <div style="grid-column:span 2" v-if="detail.baZi"><label>八字</label><div>{{ detail.baZi.yearPillar }} {{ detail.baZi.monthPillar }} {{ detail.baZi.dayPillar }} {{ detail.baZi.timePillar }}</div></div>
        <div style="grid-column:span 2"><label>分析结果</label><div style="white-space:pre-wrap;max-height:300px;overflow-y:auto">{{ detail.result?.analysis || '-' }}</div></div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.search-card { margin-bottom: 20px; }
</style>
