<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/api/request'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isSuper = authStore.isSuper

interface Record { id: string; userId: string; type: string; content: any; createdAt: string; user?: { username: string } }
const list = ref<Record[]>([])
const total = ref(0); const page = ref(1); const pageSize = ref(10); const loading = ref(false)
const showDetail = ref(false); const detail = ref<Record | null>(null)

onMounted(() => fetchList())

async function fetchList() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, pageSize: pageSize.value }
    const res: any = await request.get('/admin/ai-records', { params })
    list.value = res.list || []; total.value = res.total || 0
  } catch { ElMessage.error('加载失败') }
  finally { loading.value = false }
}

function openDetail(row: Record) { detail.value = row; showDetail.value = true }

async function handleDelete(row: Record) {
  try {
    await ElMessageBox.confirm('确定删除该记录吗？', '提示', { type: 'warning' })
    await request.delete(`/admin/ai-records/${row.id}`)
    ElMessage.success('已删除'); fetchList()
  } catch { /* cancelled */ }
}

function typeLabel(t: string) {
  if (t === 'gen') return '文生图'
  if (t === 'edit') return '修图'
  return t
}

function storageKey(rec: Record) { return rec.content?.storageKey || '' }
</script>

<template>
  <div>
    <el-card shadow="hover">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">{{ typeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="用户名" min-width="120">
          <template #default="{ row }">{{ row.user?.username || row.userId }}</template>
        </el-table-column>
        <el-table-column label="提示词" min-width="200">
          <template #default="{ row }">{{ row.content?.prompt || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="160">
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

    <el-dialog v-model="showDetail" title="AI 创作详情" width="640px">
      <div v-if="detail">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div><label style="color:#999;font-size:12px">类型</label><div>{{ typeLabel(detail.type) }}</div></div>
          <div><label style="color:#999;font-size:12px">用户名</label><div>{{ detail.user?.username || detail.userId }}</div></div>
          <div style="grid-column:span 2"><label style="color:#999;font-size:12px">提示词</label><div>{{ detail.content?.prompt || '-' }}</div></div>
        </div>
        <div v-if="storageKey(detail)">
          <label style="color:#999;font-size:12px">生成结果</label>
          <div style="margin-top:4px">
            <img :src="'/api/storage/' + storageKey(detail)" alt="结果" style="max-width:100%;border-radius:8px" />
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
