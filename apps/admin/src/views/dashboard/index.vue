<script setup lang="ts">
import { ref } from 'vue'

const stats = ref({
  totalUsers: 1234,
  todayUsers: 56,
  totalAnalyses: 5678,
  todayAnalyses: 123,
})

const chartData = ref({
  dates: ['03-25', '03-26', '03-27', '03-28', '03-29', '03-30', '03-31'],
  users: [45, 52, 38, 65, 48, 56, 72],
  analyses: [120, 132, 101, 134, 90, 123, 145],
})
</script>

<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon users">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalUsers }}</div>
            <div class="stat-label">总用户数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon today-users">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.todayUsers }}</div>
            <div class="stat-label">今日新增</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon analyses">
            <el-icon><Document /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalAnalyses }}</div>
            <div class="stat-label">总分析次数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-icon today-analyses">
            <el-icon><DocumentCopy /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.todayAnalyses }}</div>
            <div class="stat-label">今日分析</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover">
          <template #header>
            <span>用户增长趋势</span>
          </template>
          <div class="chart-placeholder">
            <div class="simple-chart">
              <div
                v-for="(value, index) in chartData.users"
                :key="index"
                class="bar"
                :style="{ height: (value / 100) * 200 + 'px' }"
              >
                <span class="value">{{ value }}</span>
                <span class="label">{{ chartData.dates[index] }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card shadow="hover">
          <template #header>
            <span>分析次数趋势</span>
          </template>
          <div class="chart-placeholder">
            <div class="simple-chart">
              <div
                v-for="(value, index) in chartData.analyses"
                :key="index"
                class="bar analyses"
                :style="{ height: (value / 200) * 200 + 'px' }"
              >
                <span class="value">{{ value }}</span>
                <span class="label">{{ chartData.dates[index] }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近记录 -->
    <el-card shadow="hover" class="recent-section">
      <template #header>
        <span>最近活动</span>
      </template>
      <el-table :data="[]" stripe>
        <el-table-column prop="time" label="时间" width="180" />
        <el-table-column prop="user" label="用户" width="150" />
        <el-table-column prop="action" label="操作" />
        <el-table-column prop="location" label="位置" width="200" />
      </el-table>
      <el-empty description="暂无数据" />
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.dashboard {
  .stat-cards {
    margin-bottom: 20px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    padding: 10px;

    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: #fff;
      margin-right: 16px;

      &.users {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      &.today-users {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
      &.analyses {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }
      &.today-analyses {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }
    }

    .stat-info {
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #333;
      }
      .stat-label {
        font-size: 13px;
        color: #999;
        margin-top: 4px;
      }
    }
  }

  .chart-row {
    margin-bottom: 20px;
  }

  .chart-placeholder {
    height: 250px;

    .simple-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 100%;
      padding: 20px 10px;

      .bar {
        width: 40px;
        background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
        border-radius: 4px 4px 0 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        position: relative;
        min-height: 20px;

        &.analyses {
          background: linear-gradient(180deg, #4facfe 0%, #00f2fe 100%);
        }

        .value {
          position: absolute;
          top: -24px;
          font-size: 12px;
          color: #666;
        }

        .label {
          position: absolute;
          bottom: -24px;
          font-size: 11px;
          color: #999;
          white-space: nowrap;
        }
      }
    }
  }

  .recent-section {
    margin-bottom: 20px;
  }
}
</style>
