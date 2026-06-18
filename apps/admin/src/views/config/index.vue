<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

interface Config {
  key: string
  value: string
  desc: string
}

const loading = ref(false)
const configs = ref<Config[]>([
  { key: 'TDT_KEY', value: '', desc: '天地图密钥' },
  { key: 'AMAP_KEY', value: '', desc: '高德地图密钥' },
  { key: 'QWEATHER_KEY', value: '', desc: '和风天气密钥' },
  { key: 'ANTHROPIC_API_KEY', value: '', desc: 'Claude API密钥' },
])

const form = ref<Config[]>([])

onMounted(() => {
  form.value = JSON.parse(JSON.stringify(configs.value))
})

const handleSave = async () => {
  loading.value = true
  try {
    // TODO: 调用 API 保存配置
    configs.value = JSON.parse(JSON.stringify(form.value))
    ElMessage.success('保存成功')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="config-page">
    <el-card shadow="hover">
      <template #header>
        <span>系统配置</span>
      </template>

      <el-form label-width="150px" class="config-form">
        <el-form-item
          v-for="(config, index) in form"
          :key="config.key"
          :label="config.desc"
        >
          <el-input
            v-model="form[index].value"
            :placeholder="`请输入${config.desc}`"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSave">
            保存配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.config-page {
  .config-form {
    max-width: 600px;
  }
}
</style>
