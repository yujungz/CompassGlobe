import { Router } from 'express'
import axios from 'axios'
import crypto from 'node:crypto'
import fs from 'node:fs'

const router: Router = Router()

// GCJ-02 → WGS-84 坐标转换（高德/天地图 → Cesium）
// 算法来源: https://github.com/wandergis/coordTransform
const PI = Math.PI
const X_PI = (PI * 3000.0) / 180.0
const A = 6378245.0 // 长半轴
const EE = 0.00669342162296594323 // 扁率

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

function transformLon(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

/** GCJ-02 → WGS-84 精确转换（迭代法） */
function gcj02ToWgs84(gcjLng: number, gcjLat: number): { lng: number; lat: number } {
  if (outOfChina(gcjLng, gcjLat)) return { lng: gcjLng, lat: gcjLat }

  let dLng = transformLon(gcjLng - 105.0, gcjLat - 35.0)
  let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0)
  const radLat = (gcjLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)

  return { lng: gcjLng - dLng, lat: gcjLat - dLat }
}

import { getConfig } from '../../lib/config.js'

const amapKey = () => getConfig('thirdParty.AMAP_KEY', 'AMAP_KEY')
const tdtKey = () => getConfig('thirdParty.TDT_KEY', 'TDT_KEY')
const qwHost = () => getConfig('thirdParty.QWEATHER_API_HOST', 'QWEATHER_API_HOST')
const qwPid = () => getConfig('thirdParty.QWEATHER_PROJECT_ID', 'QWEATHER_PROJECT_ID')
const qwCid = () => getConfig('thirdParty.QWEATHER_CREDENTIAL_ID', 'QWEATHER_CREDENTIAL_ID')
const QWEATHER_PRIVATE_KEY_PATH = process.env.QWEATHER_PRIVATE_KEY_PATH || ''

const isQWeatherConfigured = async () => {
  const [h, p, c] = await Promise.all([qwHost(), qwPid(), qwCid()])
  return !!(h && p && c && QWEATHER_PRIVATE_KEY_PATH)
}

// 和风 JWT 令牌生成 + 短期缓存（exp 前自动刷新，避免每次请求重签）
let qweatherTokenCache: { token: string; exp: number } | null = null
const getQWeatherToken = async (): Promise<string> => {
  const now = Math.floor(Date.now() / 1000)
  if (qweatherTokenCache && qweatherTokenCache.exp - now > 60) {
    return qweatherTokenCache.token
  }
  const [kid, sub] = await Promise.all([qwCid(), qwPid()])
  const privateKey = crypto.createPrivateKey({
    key: fs.readFileSync(QWEATHER_PRIVATE_KEY_PATH, 'utf8'),
    format: 'pem',
  })
  const iat = now - 30
  const header = { alg: 'EdDSA', kid }
  const payload = { sub, iat, exp: iat + 900 }
  const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const signingInput = `${b64url(header)}.${b64url(payload)}`
  const sig = crypto.sign(null, Buffer.from(signingInput), privateKey) // Ed25519: 算法参数传 null
  const token = `${signingInput}.${sig.toString('base64url')}`
  qweatherTokenCache = { token, exp: iat + 900 }
  return token
}

// 下发天地图密钥（前端地球仪瓦片图层使用）
// 天地图瓦片密钥本质为客户端密钥，会暴露在浏览器，生产环境应在天地图控制台配置域名白名单
router.get('/tdt-key', async (_req, res) => {
  res.json({ key: await tdtKey() })
})

// 获取位置信息
router.get('/location', async (req, res) => {
  const { longitude, latitude } = req.query

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  try {
    // 逆地理编码
    let address = ''
    if (await amapKey()) {
      const response = await axios.get('https://restapi.amap.com/v3/geocode/regeo', {
        params: {
          key: await amapKey(),
          location: `${longitude},${latitude}`,
          extensions: 'base',
        },
      })
      if (response.data.status === '1') {
        address = response.data.regeocode.formatted_address
      }
    }

    // 计算时区（简化版）
    const timezone = `UTC${Math.round(parseFloat(longitude as string) / 15) >= 0 ? '+' : ''}${Math.round(parseFloat(longitude as string) / 15)}`

    res.json({
      longitude: parseFloat(longitude as string),
      latitude: parseFloat(latitude as string),
      timezone,
      address,
    })
  } catch (error) {
    console.error('获取位置信息失败:', error)
    res.json({
      longitude: parseFloat(longitude as string),
      latitude: parseFloat(latitude as string),
      timezone: 'UTC+8',
      address: '',
    })
  }
})

// 搜索附近地点（高德周边搜索）
router.get('/nearby', async (req, res) => {
  const { longitude, latitude } = req.query
  if (!longitude || !latitude) return res.status(400).json({ error: '缺少经纬度参数' })

  try {
    if (!(await amapKey())) return res.json({ places: [] })
    const response = await axios.get('https://restapi.amap.com/v3/place/around', {
      params: {
        key: await amapKey(),
        location: `${longitude},${latitude}`,
        radius: 3000,
        offset: 10,
        page: 1,
        extensions: 'base',
      },
      timeout: 5000,
    })
    const pois = response.data?.pois || []
    res.json({
      places: pois.map((p: any) => {
        const gLng = parseFloat(p.location?.split(',')[0] || '0')
        const gLat = parseFloat(p.location?.split(',')[1] || '0')
        const wgs = gcj02ToWgs84(gLng, gLat)
        return {
          name: p.name,
          type: p.type?.split(';')[0] || '',
          address: p.address,
          distance: p.distance ? `${p.distance}m` : '',
          direction: p.direction || '',
          longitude: wgs.lng,
          latitude: wgs.lat,
        }
      }),
    })
  } catch {
    res.json({ places: [] })
  }
})

// 搜索地点（高德周边 POI 搜索，基于当前中心点半径内精确匹配）
router.get('/search-place', async (req, res) => {
  const { keyword, longitude, latitude } = req.query
  if (!keyword || !longitude || !latitude) return res.status(400).json({ error: '缺少参数' })

  try {
    if (!(await amapKey())) return res.json(null)
    // 先用逆地理编码获取城市名
    let city = ''
    try {
      const geoResp = await axios.get('https://restapi.amap.com/v3/geocode/regeo', {
        params: { key: await amapKey(), location: `${longitude},${latitude}`, extensions: 'base' },
        timeout: 3000,
      })
      city = geoResp.data?.regeocode?.addressComponent?.city || ''
      if (!city) city = geoResp.data?.regeocode?.addressComponent?.province || ''
    } catch { /* ignore */ }

    // 用 text 搜索 + city 限制范围
    const response = await axios.get('https://restapi.amap.com/v3/place/text', {
      params: {
        key: await amapKey(),
        keywords: keyword,
        city: city || undefined,
        citylimit: city ? 'true' : undefined,
        location: `${longitude},${latitude}`,
        sortrule: 'distance',
        offset: 1,
        page: 1,
      },
      timeout: 5000,
    })
    const poi = response.data?.pois?.[0] || null
    if (poi) {
      const gLng = parseFloat(poi.location?.split(',')[0] || '0')
      const gLat = parseFloat(poi.location?.split(',')[1] || '0')
      const wgs = gcj02ToWgs84(gLng, gLat)
      res.json({ name: poi.name, address: poi.address, longitude: wgs.lng, latitude: wgs.lat })
    } else {
      res.json(null)
    }
  } catch {
    res.json(null)
  }
})

// 海拔数据源：主备双源，自动降级
// 主源 Open-Meteo（Copernicus DEM，全球覆盖含海底），备源 OpenTopoData（SRTM90m）
// 两者均为 WGS-84 国际源，直接传入经纬度，无需 GCJ-02 坐标转换
const fetchAltitudeFromOpenMeteo = async (lat: number, lon: number): Promise<number | null> => {
  const resp = await axios.get('https://api.open-meteo.com/v1/elevation', {
    params: { latitude: lat, longitude: lon },
    timeout: 5000,
  })
  // Open-Meteo 的 elevation 恒为数组，单点也返回 [elev]
  const elev = resp.data?.elevation?.[0]
  return typeof elev === 'number' ? elev : null
}

const fetchAltitudeFromOpenTopoData = async (lat: number, lon: number): Promise<number | null> => {
  const resp = await axios.get('https://api.opentopodata.org/v1/srtm90m', {
    params: { locations: `${lat},${lon}` },
    timeout: 5000,
  })
  // 海洋/无 DEM 覆盖处 elevation 为 null
  const elev = resp.data?.results?.[0]?.elevation
  return typeof elev === 'number' ? elev : null
}

// 获取海拔（主备双源，自动降级）
router.get('/altitude', async (req, res) => {
  const { longitude, latitude } = req.query

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  const lat = parseFloat(latitude as string)
  const lon = parseFloat(longitude as string)
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: '经纬度参数无效' })
  }

  // 主源：Open-Meteo
  try {
    const altitude = await fetchAltitudeFromOpenMeteo(lat, lon)
    if (altitude !== null) {
      return res.json({ altitude, source: 'open-meteo' })
    }
  } catch (e) {
    console.warn('Open-Meteo 海拔查询失败，降级到 OpenTopoData:', (e as Error).message)
  }

  // 备源：OpenTopoData (SRTM90m)
  try {
    const altitude = await fetchAltitudeFromOpenTopoData(lat, lon)
    if (altitude !== null) {
      return res.json({ altitude, source: 'opentopodata' })
    }
  } catch (e) {
    console.warn('OpenTopoData 海拔查询失败:', (e as Error).message)
  }

  // 双源均无数据（如深海、无 DEM 覆盖区域）
  res.json({ altitude: 0, source: 'none' })
})

// 获取天气（和风天气 JWT 认证；未配置或失败时返回兜底数据）
router.get('/weather', async (req, res) => {
  const { longitude, latitude } = req.query

  if (!longitude || !latitude) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  const fallback = {
    temperature: 25,
    humidity: 60,
    windSpeed: 10,
    windDirection: '东南风',
    weather: '晴',
  }

  if (!(await isQWeatherConfigured())) {
    return res.json(fallback)
  }

  try {
    const [token, host] = await Promise.all([getQWeatherToken(), qwHost()])
    const response = await axios.get(`https://${host}/v7/weather/now`, {
      params: { location: `${longitude},${latitude}`, lang: 'zh' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    })

    if (response.data?.code === '200' && response.data.now) {
      const now = response.data.now
      return res.json({
        temperature: parseInt(now.temp),
        humidity: parseInt(now.humidity),
        windSpeed: parseInt(now.windSpeed),
        windDirection: now.windDir,
        weather: now.text,
      })
    }
    console.warn('和风天气返回非 200:', response.data)
    return res.json(fallback)
  } catch (error) {
    console.error('获取天气失败:', (error as Error).message)
    return res.json(fallback)
  }
})

export default router
