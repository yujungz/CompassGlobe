<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isSuper = authStore.isSuper

interface Record { id: string; userId: string; images: string[]; descriptions: string[]; result: any; createdAt: string }
const list = ref<Record[]>([])
const total = ref(0); const page = ref(1); const pageSize = ref(10); const loading = ref(false)
const showDetail = ref(false); const detail = ref<Record | null>(null)
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
    const res: any = await request.get('/admin/fengshui-homes', { params })
    list.value = res.list || []; total.value = res.total || 0
  } catch { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

const handleSearch = () => { page.value = 1; fetchList() }
const handleReset = () => { searchForm.value = { username: '', startDate: null, endDate: null }; page.value = 1; fetchList() }
function handleSelectionChange(rows: Record[]) { selectedIds.value = rows.map(r => r.id) }

async function openDetail(id: string) {
  try {
    const res: any = await request.get(`/admin/fengshui-homes/${id}`)
    detail.value = res; showDetail.value = true
  } catch { ElMessage.error('获取详情失败') }
}

async function handleDelete(row: Record) {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', { type: 'warning' })
    await request.delete(`/admin/fengshui-homes/${row.id}`)
    ElMessage.success('已删除')
    fetchList()
  } catch { /* cancelled */ }
}

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) { ElMessage.warning('请先选择要删除的记录'); return }
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条记录吗？`, '批量删除', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    deleting.value = true
    await Promise.all(selectedIds.value.map(id => request.delete(`/admin/fengshui-homes/${id}`).catch(() => {})))
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
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="hover">
      <div v-if="isSuper" style="margin-bottom:12px">
        <el-button type="danger" :disabled="selectedIds.length === 0" :loading="deleting" @click="handleBatchDelete">批量删除（{{ selectedIds.length }}）</el-button>
      </div>
      <el-table :data="list" v-loading="loading" stripe @selection-change="handleSelectionChange">
        <el-table-column v-if="isSuper" type="selection" width="50" />
        <el-table-column label="用户名" min-width="120"><template #default="{ row }">{{ row.user?.username || row.userId }}</template></el-table-column>
        <el-table-column label="图片数" width="80"><template #default="{ row }">{{ row.images?.length || 0 }}</template></el-table-column>
        <el-table-column label="时间" min-width="160"><template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template></el-table-column>
        <el-table-column label="操作" min-width="140">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openDetail(row.id)">查看详情</el-button>
            <el-button v-if="isSuper" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:20px;display:flex;justify-content:flex-end">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @size-change="fetchList" @current-change="fetchList" />
      </div>
    </el-card>
    <el-dialog v-model="showDetail" title="居家风水详情" width="640px">
      <div v-if="detail">
        <div style="margin-bottom:8px"><label style="color:#999;font-size:12px">用户名</label> {{ detail.user?.username || detail.userId }}</div>
        <div style="margin-bottom:8px"><label style="color:#999;font-size:12px">图片说明</label>
          <div v-for="(d,i) in detail.descriptions" :key="i">{{ i+1 }}. {{ d || '(无)' }}</div>
        </div>
        <div><label style="color:#999;font-size:12px">分析结果</label>
          <div style="white-space:pre-wrap;max-height:300px;overflow-y:auto">{{ detail.result?.analysis || '-' }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.search-card { margin-bottom: 20px; }
</style>
