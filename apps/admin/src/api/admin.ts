import request from './request'

export interface AdminInfo {
  id: string
  username: string
  nickname: string | null
  role: string
  status: number
  createdAt: string
}

export const adminApi = {
  login(data: { username: string; password: string }) {
    return request.post('/admin/login', data) as Promise<{ token: string; admin: AdminInfo }>
  },

  getMe() {
    return request.get('/admin/me') as Promise<AdminInfo>
  },

  getAdmins() {
    return request.get('/admin/admins') as Promise<AdminInfo[]>
  },

  createAdmin(data: { username: string; password: string; nickname?: string; role?: string }) {
    return request.post('/admin/admins', data) as Promise<AdminInfo>
  },

  updatePassword(id: string, password: string) {
    return request.put(`/admin/admins/${id}/password`, { password }) as Promise<{ message: string }>
  },

  updateStatus(id: string, status: number) {
    return request.put(`/admin/admins/${id}/status`, { status }) as Promise<{ message: string }>
  },

  deleteAdmin(id: string) {
    return request.delete(`/admin/admins/${id}`) as Promise<{ message: string }>
  },
}
