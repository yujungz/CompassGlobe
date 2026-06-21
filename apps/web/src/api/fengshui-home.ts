import request from './request'

export interface FengshuiHomeRecord {
  id: string
  images: string[]
  descriptions: string[]
  result: { analysis: string } | null
  createdAt: string
}

export interface FengshuiHomeList {
  list: FengshuiHomeRecord[]
  total: number
  page: number
  pageSize: number
}

export const fengshuiHomeApi = {
  getPdfUrl(id: string) { return `/api/fengshui-home/${id}/pdf` },
  // 上传图片并开始分析（multipart/form-data）
  analyze(files: File[], descriptions: string[]) {
    const formData = new FormData()
    files.forEach((file) => formData.append('images', file))
    formData.append('descriptions', JSON.stringify(descriptions))
    return request.post<FengshuiHomeRecord>('/fengshui-home', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min
    })
  },

  getList(page = 1, pageSize = 10) {
    return request.get<FengshuiHomeList>('/fengshui-home', { params: { page, pageSize } })
  },

  getDetail(id: string) {
    return request.get<FengshuiHomeRecord>(`/fengshui-home/${id}`)
  },

  delete(id: string) {
    return request.delete(`/fengshui-home/${id}`)
  },
}
