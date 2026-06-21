<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { conversationApi, type MessageItem, type ConversationDetail } from '@/api/conversation'

const props = defineProps<{
  conversationId: string
}>()

const emit = defineEmits<{
  (e: 'titleUpdate', title: string): void
}>()

const messages = ref<MessageItem[]>([])
const inputText = ref('')
const sending = ref(false)
const loading = ref(false)
const chatContainer = ref<HTMLElement>()

onMounted(async () => {
  await loadMessages()
})

watch(() => props.conversationId, async () => {
  await loadMessages()
})

async function loadMessages() {
  loading.value = true
  try {
    const conv = await conversationApi.getDetail(props.conversationId)
    messages.value = conv.messages
    if (conv.title) emit('titleUpdate', conv.title)
    await nextTick()
    scrollToBottom()
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  inputText.value = ''
  sending.value = true

  // Add user message locally
  messages.value.push({
    id: `temp_${Date.now()}`,
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  })

  // Add placeholder for assistant
  const assistantIndex = messages.value.length
  messages.value.push({
    id: `temp_assist_${Date.now()}`,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
  })

  await nextTick()
  scrollToBottom()

  try {
    const response = await fetch(`/api/ai/conversations/${props.conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ content: text }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: '发送失败' }))
      throw new Error(err.error || '发送失败')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No stream')

    const decoder = new TextDecoder()
    let fullReply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(Boolean)

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              throw new Error(parsed.error)
            }
            if (parsed.delta) {
              fullReply += parsed.delta
              messages.value[assistantIndex].content = fullReply
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e
          }
        }
      }
      await nextTick()
      scrollToBottom()
    }
  } catch (error: any) {
    // Remove placeholder on error
    messages.value.pop()
    messages.value.push({
      id: `err_${Date.now()}`,
      role: 'assistant',
      content: `❌ ${error.message || 'AI 回复失败，请稍后重试'}`,
      createdAt: new Date().toISOString(),
    })
  } finally {
    sending.value = false
  }
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div class="chat-panel">
    <div ref="chatContainer" class="chat-messages">
      <div v-if="loading" class="chat-loading">加载中...</div>
      <template v-else>
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['message', msg.role === 'user' ? 'user-msg' : 'assistant-msg']"
        >
          <div class="msg-avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
          <div class="msg-content">
            <div class="msg-text">{{ msg.content || (msg.role === 'assistant' && sending ? '思考中...' : '') }}</div>
          </div>
        </div>
      </template>
    </div>

    <div class="chat-input-area">
      <textarea
        v-model="inputText"
        class="chat-input"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        rows="2"
        :disabled="sending"
        @keydown="handleKeydown"
      ></textarea>
      <button class="send-btn" :disabled="!inputText.trim() || sending" @click="sendMessage">
        {{ sending ? '发送中' : '发送' }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-loading {
  text-align: center;
  color: #999;
  padding: 40px;
}

.message {
  display: flex;
  gap: 10px;
  max-width: 85%;

  &.user-msg {
    align-self: flex-end;
    flex-direction: row-reverse;
    .msg-avatar { background: #4a90d9; }
    .msg-content { align-items: flex-end; }
    .msg-text { background: #4a90d9; color: #fff; border-radius: 12px 12px 4px 12px; }
  }

  &.assistant-msg {
    align-self: flex-start;
    .msg-avatar { background: #6c757d; }
    .msg-content { align-items: flex-start; }
    .msg-text { background: #f0f0f0; color: #333; border-radius: 12px 12px 12px 4px; }
  }
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.msg-content {
  display: flex;
  flex-direction: column;
}

.msg-text {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-input-area {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #e8e8e8;
  background: #fff;
}

.chat-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
  &:focus { outline: none; border-color: #4a90d9; }
}

.send-btn {
  padding: 0 20px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  &:hover:not(:disabled) { background: #357abd; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
