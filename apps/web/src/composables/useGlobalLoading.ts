import { ref, type Ref } from 'vue'

export interface LoadingState {
  active: Ref<boolean>
  elapsed: Ref<number>
  timer: ReturnType<typeof setInterval> | null
  startTime: number
}

const globalLoading = ref(false)
const globalElapsed = ref(0)
const globalMessage = ref('')
let globalTimer: ReturnType<typeof setInterval> | null = null
let globalStart = 0

export function useGlobalLoading() {
  function startLoading(msg?: string) {
    globalLoading.value = true
    globalElapsed.value = 0
    globalMessage.value = msg || '处理中，请耐心等候…'
    globalStart = Date.now()
    if (globalTimer) clearInterval(globalTimer)
    globalTimer = setInterval(() => {
      globalElapsed.value = Math.floor((Date.now() - globalStart) / 1000)
    }, 200)
  }

  function stopLoading() {
    globalLoading.value = false
    if (globalTimer) clearInterval(globalTimer)
    globalTimer = null
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m > 0 ? `${m}分${s}秒` : `${s}秒`
  }

  return {
    globalLoading,
    globalElapsed,
    globalMessage,
    startLoading,
    stopLoading,
    formatTime,
  }
}
