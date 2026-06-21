import request from './request'

export interface AdminInfo {
  id: string
  username: string
  nickname: string | null
  role: string
  status: number
  createdAt: string
}

export interface AdminUserInfo {
  id: string
  username: string
  phone: string | null
  email: string | null
  realName: string | null
  nickname: string | null
  gender: string | null
  realNameStatus: string
  loginType: string
  registrationMethod: string
  imageCount: number
  consultCount: number
  status: number
  createdAt: string
}

export interface UserDetail extends AdminUserInfo {
  birthYear: number | null
  birthMonth: number | null
  birthDay: number | null
  birthHour: number | null
  avatar: string | null
  wechat: string | null
  qq: string | null
  birthAddress: string | null
  company: string | null
  companyAddress: string | null
  industry: string | null
  profession: string | null
  remark: string | null
  idCard: string | null
  wechatOpenId: string | null
  updatedAt: string
}

export interface PaginatedUsers {
  list: AdminUserInfo[]
  total: number
  page: number
  pageSize: number
}

export const adminApi = {
  login(data: { username: string; password: string }) {
    return request.post('/admin/login', data) as Promise<{ token: string; admin: AdminInfo }>
  },

  getMe() {
    return request.get('/admin/me') as Promise<AdminInfo>
  },

  // Admin management
  getAdmins() {
    return request.get('/admin/admins') as Promise<AdminInfo[]>
  },

  createAdmin(data: { username: string; password: string; nickname?: string; role?: string }) {
    return request.post('/admin/admins', data) as Promise<AdminInfo>
  },

  updateAdmin(id: string, data: { username?: string; nickname?: string; role?: string }) {
    return request.put(`/admin/admins/${id}`, data) as Promise<AdminInfo>
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

  // User management
  getUsers(params: { page?: number; pageSize?: number; keyword?: string; status?: string }) {
    return request.get('/admin/users', { params }) as Promise<PaginatedUsers>
  },

  getUserDetail(id: string) {
    return request.get(`/admin/users/${id}`) as Promise<UserDetail>
  },

  updateUser(id: string, data: Record<string, any>) {
    return request.put(`/admin/users/${id}`, data) as Promise<any>
  },

  updateUserStatus(id: string, status: number) {
    return request.put(`/admin/users/${id}/status`, { status }) as Promise<{ message: string }>
  },

  updateUserRealName(id: string, status: string) {
    return request.put(`/admin/users/${id}/real-name`, { status }) as Promise<{ message: string }>
  },

  updateUserConsumption(id: string, data: { imageCount?: number; consultCount?: number }) {
    return request.put(`/admin/users/${id}/consumption`, data) as Promise<{ imageCount: number; consultCount: number }>
  },

  updateUserPassword(id: string, password: string) {
    return request.put(`/admin/users/${id}/password`, { password }) as Promise<{ message: string }>
  },

  deleteUser(id: string) {
    return request.delete(`/admin/users/${id}`) as Promise<{ message: string }>
  },
}
