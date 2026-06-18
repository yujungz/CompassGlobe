<script setup lang="ts">
import { ref } from 'vue'
import NavBar from '@/components/common/NavBar.vue'
import { aiApi } from '@/api/ai'

const tab = ref<'gen' | 'edit'>('gen')

// ===== 文生图 =====
const genPrompt = ref('')
const genSize = ref('1024x1024')
const genLoading = ref(false)
const genImage = ref('')
const genError = ref('')

const handleGenerate = async () => {
  if (!genPrompt.value.trim()) {
    genError.value = '请输入提示词'
    return
  }
  genError.value = ''
  genLoading.value = true
  try {
    const res = await aiApi.generateImage(genPrompt.value, { size: genSize.value })
    genImage.value = res.image
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } }
    genError.value = err?.response?.data?.error || '生成失败，请稍后重试'
  } finally {
    genLoading.value = false
  }
}

// ===== 修图 =====
const editPrompt = ref('')
const editSource = ref('') // data URL
const editLoading = ref(false)
const editResult = ref('')
const editError = ref('')

const onPickFile = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  editError.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    editSource.value = reader.result as string
    editResult.value = ''
  }
  reader.readAsDataURL(file)
}

const handleEdit = async () => {
  if (!editSource.value) {
    editError.value = '请先选择图片'
    return
  }
  if (!editPrompt.value.trim()) {
    editError.value = '请输入修改要求'
    return
  }
  editError.value = ''
  editLoading.value = true
  try {
    const res = await aiApi.editImage({ prompt: editPrompt.value, image: editSource.value })
    editResult.value = res.image
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } }
    editError.value = err?.response?.data?.error || '修图失败，请稍后重试'
  } finally {
    editLoading.value = false
  }
}
</script>

<template>
  <div class="ai-page">
    <NavBar />
    <div class="ai-wrap">
      <div class="ai-header">
        <h1 class="title">AI 创作</h1>
        <p class="subtitle">文生图 / 修图（约 10–60 秒，请耐心等待）</p>
      </div>

      <!-- 标签 -->
      <div class="tabs">
        <button :class="['tab', { active: tab === 'gen' }]" @click="tab = 'gen'">文生图</button>
        <button :class="['tab', { active: tab === 'edit' }]" @click="tab = 'edit'">修图</button>
      </div>

      <!-- 文生图 -->
      <section v-if="tab === 'gen'" class="card">
        <textarea v-model="genPrompt" class="prompt-input" rows="3" placeholder="描述你想要的画面，例如：一只在月球上的橘猫，卡通风格"></textarea>
        <div class="form-row">
          <select v-model="genSize" class="size-select">
            <option value="1024x1024">1024 × 1024（方图）</option>
            <option value="1536x1024">1536 × 1024（横图）</option>
            <option value="1024x1536">1024 × 1536（竖图）</option>
          </select>
          <button class="btn-primary" :disabled="genLoading" @click="handleGenerate">
            {{ genLoading ? '生成中…' : '生成图片' }}
          </button>
        </div>
        <p v-if="genError" class="error">{{ genError }}</p>
        <div v-if="genImage" class="result">
          <img :src="genImage" alt="生成结果" class="result-img" />
          <a :href="genImage" download="compassglobe-gen.png" class="download-link">下载</a>
        </div>
      </section>

      <!-- 修图 -->
      <section v-else class="card">
        <label class="upload-area">
          <input type="file" accept="image/png,image/jpeg" @change="onPickFile" />
          <span v-if="!editSource" class="upload-hint">点击选择要编辑的图片（PNG / JPG）</span>
          <img v-else :src="editSource" alt="原图" class="source-img" />
        </label>
        <textarea v-model="editPrompt" class="prompt-input" rows="2" placeholder="修改要求，例如：给猫戴上一顶红色圣诞帽"></textarea>
        <div class="form-row">
          <button class="btn-primary" :disabled="editLoading" @click="handleEdit">
            {{ editLoading ? '编辑中…' : '开始修图' }}
          </button>
        </div>
        <p v-if="editError" class="error">{{ editError }}</p>
        <div v-if="editResult" class="result">
          <img :src="editResult" alt="修图结果" class="result-img" />
          <a :href="editResult" download="compassglobe-edit.png" class="download-link">下载</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.ai-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.ai-header {
  text-align: center;
  margin-bottom: 20px;

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

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 4px;

  .tab {
    flex: 1;
    padding: 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    cursor: pointer;

    &.active {
      background: rgba(74, 144, 217, 0.2);
      color: #fff;
      font-weight: 500;
    }
  }
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
}

.prompt-input {
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;

  &::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }
  &:focus {
    outline: none;
    border-color: #4a90d9;
  }
}

.form-row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: center;
}

.size-select {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
}

.btn-primary {
  margin-left: auto;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.error {
  margin: 12px 0 0;
  padding: 10px;
  background: rgba(231, 76, 60, 0.15);
  border-radius: 8px;
  color: #ff9f9f;
  font-size: 13px;
}

.result {
  margin-top: 16px;
  text-align: center;

  .result-img,
  .source-img {
    max-width: 100%;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .download-link {
    display: inline-block;
    margin-top: 10px;
    color: #4a90d9;
    font-size: 13px;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;

  input[type='file'] {
    display: none;
  }

  .upload-hint {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }
}

.prompt-input + .form-row,
.upload-area + .prompt-input {
  margin-top: 12px;
}
</style>
