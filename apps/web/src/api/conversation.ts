import request from './request'

export interface ConversationItem {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

export interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface ConversationDetail {
  id: string
  userId: string
  title: string | null
  createdAt: string
  updatedAt: string
  messages: MessageItem[]
}

export const conversationApi = {
  create() {
    return request.post<ConversationItem>('/ai/conversations')
  },

  getList() {
    return request.get<ConversationItem[]>('/ai/conversations')
  },

  getDetail(id: string) {
    return request.get<ConversationDetail>(`/ai/conversations/${id}`)
  },

  sendMessage(conversationId: string, content: string) {
    return request.post(`/ai/conversations/${conversationId}/messages`, { content }, {
      responseType: 'stream',
      headers: { Accept: 'text/event-stream' },
    }) as Promise<Response>
  },

  delete(id: string) {
    return request.delete(`/ai/conversations/${id}`)
  },
}
