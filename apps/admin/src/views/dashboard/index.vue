<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/api/request'

const stats = ref({
  totalUsers: 0, todayUsers: 0, totalAnalyses: 0, todayAnalyses: 0,
  totalFengshui: 0, totalFortune: 0, totalDivination: 0, totalConversations: 0,
})
const chart = ref({ days: [] as string[], userCounts: [] as number[], analysisCounts: [] as number[] })
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res: any = await request.get('/admin/dashboard')
    if (res.stats) stats.value = res.stats
    if (res.chart) chart.value = res.chart
  } catch { /* ignore */ }
  finally { loading.value = false }
})

const maxUser = Math.max(1, ...chart.value.userCounts)
const maxAnalysis = Math.max(1, ...chart.value.analysisCounts)
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon users"><el-icon><User /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalUsers }}</div><div class="stat-label">总用户数</div></div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon today-users"><el-icon><UserFilled /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.todayUsers }}</div><div class="stat-label">今日新增</div></div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon analyses"><el-icon><Document /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalAnalyses }}</div><div class="stat-label">总分析次数</div></div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon today-analyses"><el-icon><DocumentCopy /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.todayAnalyses }}</div><div class="stat-label">今日分析</div></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon fengshui"><el-icon><Picture /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalFengshui }}</div><div class="stat-label">居家风水</div></div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon fortune"><el-icon><TrendCharts /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalFortune }}</div><div class="stat-label">流年大运</div></div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon divination"><el-icon><MagicStick /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalDivination }}</div><div class="stat-label">八卦问事</div></div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon conv"><el-icon><ChatDotRound /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalConversations }}</div><div class="stat-label">AI 对话</div></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover"><template #header><span>用户增长趋势（7天）</span></template>
          <div class="chart-placeholder">
            <div class="simple-chart">
              <div v-for="(v,i) in chart.userCounts" :key="i" class="bar" :style="{ height: (v / maxUser) * 180 + 'px' }">
                <span class="value">{{ v }}</span><span class="label">{{ chart.days[i] }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover"><template #header><span>分析次数趋势（7天）</span></template>
          <div class="chart-placeholder">
            <div class="simple-chart">
              <div v-for="(v,i) in chart.analysisCounts" :key="i" class="bar analyses" :style="{ height: (v / maxAnalysis) * 180 + 'px' }">
                <span class="value">{{ v }}</span><span class="label">{{ chart.days[i] }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  .stat-cards { margin-bottom: 20px; }
  .stat-card {
    display: flex; align-items: center; padding: 10px;
    .stat-icon {
      width: 60px; height: 60px; border-radius: 8px; display: flex; align-items: center;
      justify-content: center; font-size: 28px; color: #fff; margin-right: 16px;
      &.users { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      &.today-users { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
      &.analyses { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
      &.today-analyses { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
      &.fengshui { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
      &.fortune { background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); }
      &.divination { background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); }
      &.conv { background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%); }
    }
    .stat-info {
      .stat-value { font-size: 24px; font-weight: 600; color: #333; }
      .stat-label { font-size: 13px; color: #999; margin-top: 4px; }
    }
  }
  .chart-row { margin-bottom: 20px; }
  .chart-placeholder { height: 230px; }
  .simple-chart {
    display: flex; align-items: flex-end; justify-content: space-around; height: 100%; padding: 20px 10px;
    .bar {
      width: 40px; background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px 4px 0 0; display: flex; flex-direction: column; align-items: center;
      justify-content: flex-end; position: relative; min-height: 20px;
      &.analyses { background: linear-gradient(180deg, #4facfe 0%, #00f2fe 100%); }
      .value { position: absolute; top: -24px; font-size: 12px; color: #666; }
      .label { position: absolute; bottom: -24px; font-size: 11px; color: #999; white-space: nowrap; }
    }
  }
}
</style>
