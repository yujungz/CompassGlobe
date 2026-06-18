import request from './request'

export interface LocationInfo {
  longitude: number
  latitude: number
  altitude: number
  timezone: string
  address?: string
}

// 天气信息（后端 /weather，和风天气 JWT 认证）
export interface WeatherInfo {
  temperature: number
  humidity: number
  windSpeed: number
  windDirection: string
  weather: string
}

export const globeApi = {
  // 获取天地图密钥（用于地球仪瓦片图层）
  getTdtKey() {
    return request.get<{ key: string }>('/globe/tdt-key')
  },

  // 获取位置详细信息
  getLocationInfo(longitude: number, latitude: number) {
    return request.get<LocationInfo>('/globe/location', {
      params: { longitude, latitude },
    })
  },

  // 获取天气信息
  getWeather(longitude: number, latitude: number) {
    return request.get<WeatherInfo>('/globe/weather', {
      params: { longitude, latitude },
    })
  },

  // 获取海拔（主源 open-meteo，备源 opentopodata，自动降级）
  getAltitude(longitude: number, latitude: number) {
    return request.get<{ altitude: number; source?: string }>('/globe/altitude', {
      params: { longitude, latitude },
    })
  },
}
